const fs = require("fs");
const readline = require("readline");
const {Trie} = require("./trie");

//Path to the dictionary file
//Recommended source: https://raw.githubusercontent.com/andrewchen3019/wordle/refs/heads/main/Collins%20Scrabble%20Words%20(2019).txt
const DICTIONARY = "scrabble_words.txt";
//Path to the word frequency file
//Recommended source: https://www.kaggle.com/datasets/wheelercode/dictionary-word-frequency
const FREQ_FILTER = "ngram_freq_dict.csv";
//Width of the word grid
const SIZE_W = 5;
//Height of the word grid
const SIZE_H = 5;
//Filter horizontal words to be in the top-N (or 0 for all words)
const MIN_FREQ_W = 15000;
//Filter vertical words to be in the top-N (or 0 for all words)
const MIN_FREQ_H = 15000;
//Only print solutions with all unique words (only for square grids)
const UNIQUE = true;
//Diagonals must also be words (only for square grids)
const DIAGONALS = false;

const VTRIE_SIZE = DIAGONALS ? SIZE_W + 2 : SIZE_W;
const banned = [
  //Feel free to add words you don't want to see here
];

//Using global variables makes the recursive calls more compact
let g_freqs = {}, 
  g_trie_w = new Trie(), 
  g_trie_h = new Trie(), 
  g_words = new Array(SIZE_H * SIZE_W).fill(0);

//Dictionary should be list of words separated by newlines
async function LoadDictionary(fname, length, trie, min_freq) {
  console.log(`Loading Dictionary ${fname}...`);
  let num_words = 0;
  const fin = fs.createReadStream(fname);
  const rl = readline.createInterface({
    input: fin,
    crlfDelay: Infinity
  });
  const have_g_freqs = Object.keys(g_freqs).length > 0;
  for await (let line of rl) {
    if (line.length != length) { continue; }
    line = line.toUpperCase();
    if (have_g_freqs && min_freq > 0) {
      const freq = g_freqs[line];
      if (!freq || freq > min_freq) { continue; }
    }
    if (banned.includes(line)) { continue; }
    trie.add(line);
    num_words++;
  }
  console.log(`Loaded ${num_words} words.`);
}

//Frequency list is expecting a sorted 2-column CSV with header
//First column is the word, second column is the frequency
async function LoadFreq(fname) {
  console.log(`Loading Frequency List ${fname}...`);
  let num_words = 0;
  const fin = fs.createReadStream(fname);
  const rl = readline.createInterface({
    input: fin,
    crlfDelay: Infinity,
  });
  let first = true;
  for await (let line of rl) {
    if (first) { first = false; continue; }
    let str = line.substring(0, line.indexOf(','));
    str = str.toUpperCase();
    g_freqs[str] = num_words;
    num_words++;
  }
  console.log(`Loaded ${num_words} words.`);
}

//Print a solution
function PrintBox(words) {
  //Do a uniqueness check if requested
  if (UNIQUE && SIZE_H == SIZE_W) {
    for (let i = 0; i < SIZE_H; ++i) {
      let num_same = 0;
      for (let j = 0; j < SIZE_W; ++j) {
        if (words[i * SIZE_W + j] == words[j * SIZE_W + i]) {
          num_same++;
        }
      }
      if (num_same == SIZE_W) { return; }
    }
  }
  //Print the grid
  for (let h = 0; h < SIZE_H; ++h) {
    for (let w = 0; w < SIZE_W; ++w) {
      process.stdout.write(words[h * SIZE_W + w]);
    }
    process.stdout.write("\n");
  }
  process.stdout.write("\n");
}

function BoxSearch(trie, vtries, pos) {
  //Reset when coming back to first letter
  const v_ix = pos % SIZE_W;
  const h_ix = pos / SIZE_W;
  //Check if this is the beginning of a row
  if (v_ix == 0) {
    //If the entire grid is filled, we're done, print the solution
    if (pos == SIZE_H * SIZE_W) {
      PrintBox(g_words);
      return;
    }
    //Reset the horizontal trie position to the beginning
    trie = g_trie_w;
  }
  let iter = trie.iter();
  while (iter.next()) {
    //Try next letter if vertical trie fails
    if (!vtries[v_ix].hasIx(iter.getIx())) { continue; }
    //Show progress bar
    if (pos == 0) { process.stdout.write(`=== [${iter.getLetter()}] ===\n`); }
    if (DIAGONALS) {
      if (h_ix == v_ix) {
        if (!vtries[VTRIE_SIZE - 2].hasIx(iter.getIx())) { continue; }
      }
      if (h_ix == SIZE_W - v_ix - 1) {
        if (!vtries[VTRIE_SIZE - 1].hasIx(iter.getIx())) { continue; }
      }
    }
    //Letter is valid, update the solution
    g_words[pos] = iter.getLetter();
    //Make a backup of the vertical trie position in the stack for backtracking
    const backup_vtrie = vtries[v_ix];
    //Update the vertical trie position
    vtries[v_ix] = vtries[v_ix].decend(iter.getIx());
    const backup_dtrie1 = vtries[VTRIE_SIZE - 2];
    const backup_dtrie2 = vtries[VTRIE_SIZE - 1];
    if (DIAGONALS) {
      if (h_ix == v_ix) {
        vtries[VTRIE_SIZE - 2] = vtries[VTRIE_SIZE - 2].decend(iter.getIx());
      }
      if (h_ix == SIZE_W - v_ix - 1) {
        vtries[VTRIE_SIZE - 1] = vtries[VTRIE_SIZE - 1].decend(iter.getIx());
      }
    }
    //Make the recursive call
    BoxSearch(iter.get(), vtries, pos + 1);
    //After returning, restore the vertical trie position from the stack
    vtries[v_ix] = backup_vtrie;
    if (DIAGONALS) {
      vtries[VTRIE_SIZE - 2] = backup_dtrie1;
      vtries[VTRIE_SIZE - 1] = backup_dtrie2;
    }
  }
}


(async () => {

  //Load word frequency list
  await LoadFreq(FREQ_FILTER);

  //Load horizontal trie from dictionary
  await LoadDictionary(DICTIONARY, SIZE_W, g_trie_w, MIN_FREQ_W);
  let trie_h = g_trie_w;
  if (SIZE_W != SIZE_H) {
    //Load vertical trie from dictionary (if needed)
    await LoadDictionary(DICTIONARY, SIZE_H, g_trie_h, MIN_FREQ_H);
    trie_h = g_trie_h;
  }

  //Initialize all vertical tries
  let vtries = new Array(VTRIE_SIZE).fill(trie_h);

  //Run the search
  BoxSearch(null, vtries, 0);
  console.log("Done.");

})().then(process.exit);