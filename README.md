# coc-typos

[Typos](https://github.com/crate-ci/typos) integration with coc.nvim.

It checks typos with opened buffer automatically.

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

" Fix typo at cursor position, completion menu would be shown when possible
nmap z= <Plug>(coc-typos-fix)
```

File(s) specified by 'spellfile' option is loaded for known words when exists,
use `zg` and `zug` to add and remove global known words. Or use
[\_typos.toml](https://github.com/crate-ci/typos#false-positives)

**Note**: to make completion always shown, you may need use
`set completeopt=menuone,noselect` in your vimrc.

## Commands

- `typos.reloadSpellfile` force reload 'spellfile' for known words.

## Options

- `typos.command`: Command used to invoke typos. default: `"typos"`
- `typos.disabledFiletypes`: Filetypes that should by ignored by typos. default: `[]`
- `typos.highlightGroup`: Highlight group used for bad spelled text. default: `"SpellBad"`

## Troubleshooting

Use command `:CocCommand workspace.showOutput typos` to open output channel.

## License

MIT

---

> This extension is built with [create-coc-extension](https://github.com/fannheyward/create-coc-extension)
