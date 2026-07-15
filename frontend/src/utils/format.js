// Turn a disease slug like "bacterial_leaf_blight" into "Bacterial Leaf Blight".
export const titleCaseDisease = (slug = "") =>
  slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
