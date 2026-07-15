// Turn a disease slug like "bacterial_leaf_blight" into "Bacterial Leaf Blight".
export const titleCaseDisease = (slug = "") =>
  slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// The /query summary is the raw embedding document (Crop/Disease/Local name/
// Pathogen/Visual symptoms/Growth impact/Treatments). Show only the visual
// symptoms, since crop, disease name, and pathogen are already displayed above.
export const cleanSymptoms = (text = "") => {
  const start = text.indexOf("Visual symptoms:");
  if (start === -1) return text;
  let rest = text.slice(start + "Visual symptoms:".length);
  const end = rest.search(/Growth impact:|Treatments:/);
  if (end !== -1) rest = rest.slice(0, end);
  return rest.trim();
};
