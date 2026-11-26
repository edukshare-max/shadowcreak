const enemyTypes = ['crawler', 'wolf', 'wisp', 'knight'];
const recipeIds = ['sword', 'spear', 'bow', 'armor', 'potion', 'arrows'];
const icons = new Set(['sword', 'spear', 'bow', 'armor', 'potion']);
const resources = new Set(['wood', 'ore', 'shard']);

export function validateGameData(data) {
  const check = (condition, message) => {
    if (!condition) throw new Error('Datos del juego: ' + message);
  };
  const positive = value => Number.isInteger(value) && value > 0 && value <= 100000;
  check(data && data.schemaVersion === 1, 'schemaVersion debe ser 1.');
  check(positive(data.bossHealth), 'bossHealth debe ser un entero entre 1 y 100000.');
  for (const type of enemyTypes) {
    check(positive(data.enemyHealth?.[type]), 'vida no válida para ' + type + '.');
  }
  check(Array.isArray(data.enemyPlacements) && data.enemyPlacements.length <= 200, 'enemyPlacements debe ser una lista de hasta 200 enemigos.');
  for (const placement of data.enemyPlacements) {
    check(Array.isArray(placement) && placement.length === 2 && enemyTypes.includes(placement[0]) && Number.isFinite(placement[1]) && placement[1] >= 0 && placement[1] <= 6850, 'cada enemigo debe tener un tipo válido y una posición entre 0 y 6850.');
  }
  check(Array.isArray(data.recipes) && data.recipes.length === recipeIds.length, 'deben conservarse las seis recetas.');
  check(new Set(data.recipes.map(recipe => recipe?.id)).size === recipeIds.length, 'hay recetas repetidas.');
  for (const recipe of data.recipes) {
    check(recipe && recipeIds.includes(recipe.id), 'id de receta desconocido.');
    check(icons.has(recipe.icon), 'icono de receta desconocido.');
    for (const field of ['name', 'desc']) {
      check(typeof recipe[field] === 'string' && recipe[field].length > 0 && recipe[field].length <= 300 && !/[<>]/.test(recipe[field]), field + ' de receta no válido.');
    }
    const permanent = ['sword', 'spear', 'bow', 'armor'].includes(recipe.id);
    check(permanent ? recipe.once === true : recipe.once === undefined || recipe.once === false, 'once no coincide con el tipo de receta.');
    check(recipe.cost && typeof recipe.cost === 'object' && !Array.isArray(recipe.cost), 'cost debe ser un objeto.');
    const costs = Object.entries(recipe.cost);
    check(costs.length > 0 && costs.every(([resource, value]) => resources.has(resource) && Number.isInteger(value) && value >= 0 && value <= 100000), 'cost debe contener recursos y cantidades válidas.');
  }
  return data;
}
