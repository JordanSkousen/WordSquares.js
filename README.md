# WordSquares.js

*This is a JavaScript port of HackerPoet's [WordSquares](https://github.com/HackerPoet/WordSquares), with more features and a command line interface.*

A simple JavaScript solver for dense word grids.

See this [YouTube Video](https://youtu.be/zWIsnrxL-Zc) for the best explanation.

## Usage
To use this solver, you'll first need a list of valid words and a word frequency list. If you'd like to use the same files as shown in the video, follow these links:

- Dictionary file: [Scrabble Words List](https://raw.githubusercontent.com/andrewchen3019/wordle/refs/heads/main/Collins%20Scrabble%20Words%20(2019).txt)
- Frequencies file: [NGram Viewer Frequencies](https://www.kaggle.com/datasets/wheelercode/dictionary-word-frequency)

Run the solver by using `npx wordsquares <path_to_your_dictionary_file> <path_to_your_frequencies_file>`.

## Command-line options

### Changing width and height

By default, the width and height are `5`. You can change this by specifying the dimensions at the end like `<width>x<height>`. For example, `4x6` would set the width to `4` and height to `6`.

### Changing minimum word frequency

By default, each word must be within the top 20,000th words. You can change this with the `-f` or `--frequency` flag.

To change the width/height minimum frequency individually, use `--fw` for width or `--fh` for height.

### Words that must be used

If you need each result to include certain word(s), use the `-i` or `--includes` flag. Note that every result will be checked to see if it includes ALL words you specify.

You can specify these words either in the argument directly as a string, or supply a path to a file to read the words from. Separate each word with a comma or newline. You can also use asterisks (`*`) or spaces as wildcard characters.

### Words that cannot be used (aka blocked words)

If you want to exclude certain word(s), use the `-x` or `--excludes` flag. You can then specify these words either in the argument directly as a string, or supply a path to a file to read the words from. Separate each word with a comma or newline. You can also use asterisks (`*`) or spaces as wildcard characters.

### Template

You can specify a template that each result must follow using the `-t` or `--template` flag. You can specify this template either in the argument directly as a string, or supply a path to a file to read the template from. Separate each row with a comma or newline. Use asterisks (`*`) or spaces as wildcard characters. The template must be the same dimensions as the results you're generating.

### Max results

You can limit the number of results by using the `-m` or `--max-results` flag.

### Output results to a file

You can output all results to a text file instead of the console with the `-o` or `--output`.

### Unique mode

Use the `-u` or `--unique` flag to only show WordSquares that have all unique words. This is applicable only to square grids.

### Diagonals mode

Use the `-d` or `--diagonals` flag to also check if the diagonals are valid words.

## Examples

### Generate 4x4 WordSquares

`npx wordsquares scrabble_words.txt ngram_freq_dict.csv 4x4`

### Generate WordSquares that use the top 10,000th words

`npx wordsquares scrabble_words.txt ngram_freq_dict.csv -f 10000`

### Generate WordSquares that match a template

`npx wordsquares scrabble_words.txt ngram_freq_dict.csv -t "*****,*****,ROOTS,*****,*****"`

This template would look like:

```
*****
*****
ROOTS
*****
*****
```

A possible solution to this template is:

```
SWAMP
THREE
ROOTS
ASSET
PEERS
```