'use strict';
const { run, checkLateralNav } = require('./articles-harness');

run('articles-valses', async (env) => {
  await checkLateralNav(env, 'articulo-valses-carcassi');
});
