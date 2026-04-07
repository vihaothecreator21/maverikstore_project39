/**
 * Slug Helper Utils
 * Utilities for generating and validating URL-friendly slugs
 */

/**
 * Generate a URL-friendly slug from a string
 * e.g. "Áo Thun Maverik 2024" => "ao-thun-maverik-2024"
 *
 * @param text - The text to convert to slug
 * @returns URL-friendly slug
 */
export function generateSlug(text: string): string {
  if (!text) return "";

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Validate if a slug is properly formatted
 *
 * @param slug - The slug to validate
 * @returns true if slug is valid
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
