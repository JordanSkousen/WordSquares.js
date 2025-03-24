#!/usr/bin/env node

const fs = require("fs");
const readline = require("readline");
const {docopt} = require("docopt");
const {parse} = require("csv-parse/sync");
const {Trie} = require("./trie");

const DEFAULT_WIDTH = 5;
const DEFAULT_HEIGHT = 5;
const DEFAULT_FREQUENCY = 20000;

const WildcardMatch = (str, arr) => arr.some(item => str.match(item));
function BoxToWords (box, {size_w, size_h}) {
  return new Array(size_w + size_h).fill(0).map((_, i) => {
    if (i < size_h) {
      return box.filter((_, j) => Math.floor(j / size_w) === i).join("");
    } 
    else {
      return box.filter((_, j) => j % size_w === i - size_h).join("");
    }
  })
}

//Dictionary should be list of words separated by newlines
async function LoadDictionary(options, length, trie, min_freq) {
  const {dictionary_file, excludes, includes, template, g_freqs} = options;
  console.log(`Loading dictionary file "${dictionary_file}"...`);
  let num_words = 0;
  const fin = fs.createReadStream(dictionary_file);
  const rl = readline.createInterface({
    input: fin,
    crlfDelay: Infinity
  });
  const have_g_freqs = Object.keys(g_freqs).length > 0;
  for await (let line of rl) {
    if (line.length !== length) { continue; }
    line = line.toUpperCase();
    if (have_g_freqs && min_freq > 0) {
      const freq = g_freqs[line];
      if (!freq || freq > min_freq) { continue; }
    }
    if (excludes.length > 0 && WildcardMatch(line, excludes)) { continue; }
    trie.add(line);
    num_words++;
  }
  // Some include words might not be in the dictionary, make sure to add them to the tries
  for (const include of includes) {
    trie.add(include);
  }
  // Some template words might not be in the dictionary, make sure to add them to the tries
  if (template) {
    const templateWords = BoxToWords(template.split(''), options).filter(templateWord => !templateWord.includes("*") && !templateWord.includes(" "));
    for (const templateWord of templateWords) {
      trie.add(templateWord);
    }
  }
  console.log(`Loaded ${num_words} dictionary words.`);
}

//Frequency list is expecting a sorted 2-column CSV with header
//First column is the word, second column is the frequency
async function LoadFreq(options) {
  let {frequencies_file} = options;
  console.log(`Loading Frequency List "${frequencies_file}"...`);
  const records = parse(fs.readFileSync(frequencies_file).toString(), {
    from: 2 // skips the header
  });
  const g_freqs = Object.fromEntries(records.map(([word], index) => [word.toUpperCase(), index]));
  console.log(`Loaded ${records.length} word frequencies.`);
  return {
    ...options,
    g_freqs
  };
}

function Output(options, line) {
  const {output} = options;
  if (output) {
    fs.appendFileSync(output, line);
  }
  else {
    process.stdout.write(line);
  }
}

//Print a solution
function PrintBox(box, options) {
  const {unique, includes, size_h, size_w} = options;
  //Do a uniqueness check if requested
  if (unique && size_h === size_w) {
    for (let i = 0; i < size_h; ++i) {
      let num_same = 0;
      for (let j = 0; j < size_w; ++j) {
        if (box[i * size_w + j] === box[j * size_w + i]) {
          num_same++;
        }
      }
      if (num_same === size_w) { return false; }
    }
  }
  //Check for each "includes" word if requested
  if (includes && includes.length > 0) {
    const words = BoxToWords(box, options);
    if (!includes.every(include => WildcardMatch(include, words))) {
      return false;
    }
  }
  //Print the grid
  for (let h = 0; h < size_h; ++h) {
    for (let w = 0; w < size_w; ++w) {
      Output(options, box[h * size_w + w]);
    }
    Output(options, "\n");
  }
  Output(options, "\n");
  return true;
}

function TemplateMatch(template, letter, pos) {
  if (template.length <= pos) { return false; }
  const code = template.charCodeAt(pos) - "A".charCodeAt(0);
  if (code < 0 || code >= 26) { return false; }
  return template[pos] !== letter.toUpperCase();
}

function BoxSearch(options, vtries, pos) {
  const {size_w,
         size_h,
         g_trie_w,
         vtrie_size,
         max_results,
         diagonals,
         template,
         results,
         output} = options;
  let {trie, g_words} = options;
  //Reset when coming back to first letter
  const v_ix = pos % size_w;
  const h_ix = pos / size_w;
  //Check if this is the beginning of a row
  if (v_ix == 0) {
    //If the entire grid is filled, we're done, print the solution
    if (pos == size_h * size_w) {
      if (PrintBox(g_words, options)) {
        return {
          ...options,
          results: results + 1
        };
      }
      else {
        return options;
      }
    }
    //Reset the horizontal trie position to the beginning
    trie = g_trie_w;
  }
  let iter = trie.iter();
  while (iter.next()) {
    if (template && TemplateMatch(template, iter.getLetter(), pos)) { 
      continue; 
    }
    //Try next letter if vertical trie fails
    if (!vtries[v_ix].hasIx(iter.getIx())) { continue; }
    //Show progress bar
    if (pos === 0) { 
      Output(options, `=== [${iter.getLetter()}] ===\n`); 
      if (output) {
        //We're writing result to output file, print progress to console
        console.log(`Searching "${iter.getLetter()}"s... (${Math.floor(iter.getIx() / 26 * 100)}% complete)`);
      }
    }
    if (diagonals) {
      if (h_ix === v_ix) {
        if (!vtries[vtrie_size - 2].hasIx(iter.getIx())) { continue; }
      }
      if (h_ix === size_w - v_ix - 1) {
        if (!vtries[vtrie_size - 1].hasIx(iter.getIx())) { continue; }
      }
    }
    //Letter is valid, update the solution
    g_words[pos] = iter.getLetter();
    //Make a backup of the vertical trie position in the stack for backtracking
    const backup_vtrie = vtries[v_ix];
    //Update the vertical trie position
    vtries[v_ix] = vtries[v_ix].decend(iter.getIx());
    const backup_dtrie1 = vtries[vtrie_size - 2];
    const backup_dtrie2 = vtries[vtrie_size - 1];
    if (diagonals) {
      if (h_ix === v_ix) {
        vtries[vtrie_size - 2] = vtries[vtrie_size - 2].decend(iter.getIx());
      }
      if (h_ix === size_w - v_ix - 1) {
        vtries[vtrie_size - 1] = vtries[vtrie_size - 1].decend(iter.getIx());
      }
    }
    //Make the recursive call
    options = BoxSearch({...options, trie: iter.get()}, vtries, pos + 1);
    if (max_results && options.results >= max_results) {
      // Done, max results hit
      return options;
    }
    //After returning, restore the vertical trie position from the stack
    vtries[v_ix] = backup_vtrie;
    if (diagonals) {
      vtries[vtrie_size - 2] = backup_dtrie1;
      vtries[vtrie_size - 1] = backup_dtrie2;
    }
  }
  return options;
}

// Reads string/file, parses words separated by newlines or commas to array, and converts each word into regexable query 
function ReadWords(opt) {
  if (opt) {
    let str = opt;
    if (fs.existsSync(opt)) {
      str = fs.readFileSync(opt).toString();
    }
    return str.replace(/\r\n/g, "\n").split(/[\n,]/).map(i => i.toUpperCase().replace(/[\* ]/, "."));
  }
  return [];
}


(async () => {

  const doc = `
Usage: 
  WordSquares <dictionary_file> <frequencies_file> [-f <NUM> | --fw <NUM> --fh <NUM>] [-i <TEXT|FILE>] [-x <TEXT|FILE>] [-t <TEXT|FILE>] [-m <NUM>] [-o <FILE>] [-u] [-d]
  WordSquares <dictionary_file> <frequencies_file> <width>x<height> [-f <NUM> | --fw <NUM> --fh <NUM>] [-i <TEXT|FILE>] [-x <TEXT|FILE>] [-t <TEXT|FILE>] [-m <NUM>] [-o <FILE>] [-u] [-d]
  WordSquares -h | --help
  WordSquares --version

Options:
  dictionary_file           Path to the dictionary text file. (Recommended source: https://raw.githubusercontent.com/andrewchen3019/wordle/refs/heads/main/Collins%20Scrabble%20Words%20(2019).txt)
  frequencies_file          Path to the word frequency CSV file. (Recommended source: https://www.kaggle.com/datasets/wheelercode/dictionary-word-frequency)
  -f --frequency NUM        Minimum frequency for horizontal AND vertical words (default: 20000).
  --fw NUM                  Minimum frequency for horizontal words (default: 20000).
  --fh NUM                  Minimum frequency for vertical words (default: 20000).
  -i --includes TEXT|FILE   String or path to text file of words that all must be in each result. Separate each word by commas or newlines. Use '*' or ' ' as wildcard characters.
  -x --excludes TEXT|FILE   String or path to a text file of words that none of which can be in each result. Separate each word by commas or newlines. Use '*' or ' ' as wildcard characters.
  -t --template TEXT|FILE   String or path to text file of a template that all results must conform to. Separate each row by commas or newlines. Use '*' or ' ' as wildcard characters.
  -m --max-results NUM      Set a maximum number of results to print.
  -o --output FILE          Output all results to a text file instead of console.
  -u --unique               Only print results with all unique words (applicable only for square grids).
  -d --diagonals            Diagonals must also be words (applicable only for square grids).
  -h --help                 Show this screen.
  --version                 Show version.`;
  const _options = docopt(doc, {
    version: "1.0.0"
  });
  console.log(_options);

  // delete output if exists
  const outputPath = _options['--output'];
  if (outputPath && fs.existsSync(outputPath)) {
    fs.rmSync(outputPath);
  }

  // parse <width>x<height> & check validity
  const widthByHeight = _options['<width>x<height>'];
  if (widthByHeight && !widthByHeight.toLowerCase().includes("x")) {
    return console.error("ERROR: <width>x<height> parameter is invalid!");
  }
  const [wStr, hStr] = widthByHeight ? widthByHeight?.toLowerCase().split('x') : [null, null];
  const w = widthByHeight ? Number.parseInt(wStr) : DEFAULT_WIDTH, 
    h = widthByHeight ? Number.parseInt(hStr) : DEFAULT_HEIGHT;
  if (widthByHeight && Number.isNaN(w)) {
    return console.error("ERROR: width parameter is not a number!");
  }
  if (widthByHeight && Number.isNaN(h)) {
    return console.error("ERROR: height parameter is not a number!");
  }

  // parse max-results
  const maxResultsOpt = _options['--max-results'];
  let maxResults;
  if (maxResultsOpt) {
    maxResults = Number.parseInt(maxResultsOpt);
    if (Number.isNaN(maxResults)) {
      return console.error("ERROR: max results parameter is not a number!");
    }
    if (maxResults <= 0) {
      return console.error("ERROR: max results parameter is an invalid number!");
    }
  }

  // read template to single line
  const templateOpt = _options['--template'];
  let template;
  if (templateOpt) {
    let templateStr = templateOpt;
    if (fs.existsSync(templateOpt)) {
      templateStr = fs.readFileSync(templateOpt).toString();
    }
    template = templateStr.toUpperCase().replace(/\\r\\n|\r\n|\\n|\n|,/g, "");
    if (template.length !== w * h) {
      return console.error("ERROR: template has incorrect dimensions. Make sure to include wildcards to get it to the correct width and height.");
    }
  }

  let options = {
    dictionary_file: _options['<dictionary_file>'],
    diagonals: _options['--diagonals'],
    excludes: ReadWords(_options['--excludes']),
    frequencies_file: _options['<frequencies_file>'],
    includes: ReadWords(_options['--includes']),
    min_freq_h: _options['--frequency'] || _options['--fh'] || DEFAULT_FREQUENCY,
    min_freq_w: _options['--frequency'] || _options['--fw'] || DEFAULT_FREQUENCY,
    max_results: maxResults,
    output: outputPath,
    template,
    unique: _options['--unique'],
    size_w: w,
    size_h: h,

    g_freqs: {}, 
    g_trie_w: new Trie(), 
    g_trie_h: new Trie(), 
    g_words: null,
    results: 0,
    trie: null,
    vtrie_size: null,
  };
  options.vtrie_size = options.diagonals ? options.size_w + 2 : options.size_w;
  options.g_words = new Array(options.size_h * options.size_w).fill(0);

  if (!fs.existsSync(options.dictionary_file)) {
    return console.error(`ERROR: unable to find the dictionary file at path "${options.dictionary_file}"!`);
  }
  if (!fs.existsSync(options.frequencies_file)) {
    return console.error(`ERROR: unable to find the frequencies file at path "${options.frequencies_file}"!`);
  }

  //Load word frequency list
  options = await LoadFreq(options);

  //Load horizontal trie from dictionary
  await LoadDictionary(options, options.size_w, options.g_trie_w, options.min_freq_w);
  let trie_h = options.g_trie_w;
  if (options.size_w !== options.size_h) {
    //Load vertical trie from dictionary (if needed)
    await LoadDictionary(options, options.size_h, options.g_trie_h, options.min_freq_h);
    trie_h = options.g_trie_h;
  }

  //Initialize all vertical tries
  let vtries = new Array(options.vtrie_size).fill(trie_h);

  //Run the search
  const startTime = new Date().valueOf();
  const {results} = BoxSearch(options, vtries, 0);
  const processingMs = new Date().valueOf() - startTime;
  console.log(`Found ${results} word squares in ${processingMs} ms.`);

})().then(process.exit);