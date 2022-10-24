# coc-typos

[Typos](https://github.com/crate-ci/typos) integration with coc.nvim.

It checks typos with opened buffer automatically.

![Typos screen shot](https://alfs.chigua.cn/dianyou/data/platform/default/20220422/Screen%20Shot%202022-04-22%20at%2001.55.23.png)

## Install

Install typos by:

    cargo install typos-cli

Make sure `typos` in your `$PATH`.

Install this extension in your (neo)vim by:

    :CocInstall coc-typos

## Example configuration

Following example replaces default key-mappings of vim's builtin spellcheck.

```vim
" Move to next misspelled word after the cursor, 'wrapscan' applies.
nmap ]s <Plug>(coc-typos-next)

" Move to previous misspelled word after the cursor, 'wrapscan' applies.
nmap [s <Plug>(coc-typos-prev)

" Fix typo at cursor position
nmap z= <Plug>(coc-typos-fix)
```

File(s) specified by 'spellfile' option is loaded for known words when exists,
use `zg` and `zug` to add and remove global known words. Or use
[\_typos.toml](https://github.com/crate-ci/typos#false-positives)

## Commands

- `:CocCommand typos.reloadSpellfile` force reload 'spellfile' for known words.
- `:CocCommand typos.addToSpellfile` add bad word under cursor(the range
  of bad spelled word) to 'spellfile'.
- `:CocList typos` show list of typos in current cwd (or workspace folder).

## Variable

- `b:coc_typos_count` typos count of current buffer.

## Options

- `typos.command`: Command used to invoke typos. default: `"typos"`
- `typos.disabledFiletypes`: Filetypes that should by ignored by typos. default: `[]`
- `typos.highlightGroup`: Highlight group used for bad spelled text. default: `"SpellBad"`
- `typos.listTyposArguments`: Additional arguments of typos command used for typos list. default: `[]`

## CHANGELOG

### v0.3.0

- Pass tens of thousands lines to child process could be slow, validate for changed
  lines only.

## Troubleshooting

Use command `:CocCommand workspace.showOutput typos` to open output channel.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
