/**
 * CSS Modules declaration for the plugin detail page.
 * The tsdown client build inlines `.module.css` files (hashed class map +
 * tagged <style> injection); this ambient module makes the import type-check.
 */
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>
  export default classes
}
