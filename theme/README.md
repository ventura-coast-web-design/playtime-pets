# Playtime Pets Shopify theme

This is the Shopify-hosted replacement for the Eleventy storefront in `../src`.
It deliberately keeps the original site intact so the migration can be previewed safely.

## Preview and publish

1. Install Shopify CLI and authenticate with a store you own.
2. From this `theme` directory, run `shopify theme dev --store YOUR-STORE.myshopify.com`.
3. Use the preview URL to configure the logo, menus, home collection, and app embeds.
4. Run `shopify theme check`, then `shopify theme push --unpublished`.
5. Preview the uploaded theme in Shopify Admin and publish it only after testing checkout and mobile.

## Shopify admin setup

- Create or retain the products in **Products**; the theme reads Shopify product data natively.
- Create a `Pet Toys` collection and point the home page feature section to it.
- Set the navigation menus in **Content > Menus** and select them in the theme editor.
- Configure product filters through the Shopify Search & Discovery app. The sidebar renders every enabled collection filter using Shopify URL parameters, so it works after pagination, sharing a link, or a page refresh.
- Enable these filters to match the prior shop page: **Vendor** (displayed as Brand), **product metafields** for Animal type, Breed size, and Material, **Product type** (displayed as Categories), **Price**, and the standard **Product rating** metafield. Add Availability or Tags if desired.
- Install Shopify Inbox, then enable **Online store chat** under **Theme customizer > App embeds**.

## URL migration

Create URL redirects in Shopify Admin for existing links, such as `/shop` to `/collections/pet-toys` and `/shop/old-handle` to `/products/old-handle`.

## Notes

The old Storefront API token and JavaScript cart are intentionally not used here. Shopify Liquid forms and the native cart own cart and checkout state, which avoids exposing a Storefront API dependency for the hosted theme.
