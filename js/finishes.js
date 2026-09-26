// A finish pays once, when the defeated dog lands (or immediately if grounded).
export function rateFinish({ kind, flight, pos, shotDistance = 0, airborne = false }) {
  const seq = flight?.seq || [];
  const styles = [];
  const add = (id, name, coins, when) => { if (when) styles.push({ id, name, coins }); };
  add('finishPeta', 'PETA Approved', 50, ['Buzzsaw', 'Injection', 'Radiation', 'Impaled', 'Press', 'Electrocuted', 'Anvil', 'Shredder', 'Grinder'].includes(kind));
  add('finishWindow', 'Window Dive', 45, kind === 'Fall');
  add('finishBomb', 'Kaboom', 30, kind === 'Bomb');
  add('finishShot', 'Final Shot', 25, kind === 'Pistol');
  add('finishFar', 'Long Shot', 35, kind === 'Pistol' && shotDistance >= 25);
  add('finishCar', 'Roadkill', 35, kind === 'Traffic' || seq.includes('Traffic'));
  add('finishAir', 'Airborne Finish', 20, airborne);
  add('finishSky', 'Skyfall', 40, kind === 'Collision' && (flight?.maxH || 0) >= 15);
  add('finishCombo', 'Combo Finisher', 30, (flight?.hits || 0) >= 3);
  add('finishSnow', 'Snow Demolition', 25, (flight?.smashed || 0) >= 1);
  add('finishBat', 'Batter Up', 30, kind === 'Bat' || kind === 'Home Run');
  add('finishSpike', 'Spike and Strike', 45, seq.includes('Uppercut') && seq.some((s) => s === 'Bat' || s === 'Home Run'));
  add('finishPool', 'Poolside', 25, Math.hypot(pos.x + 3, pos.z - 7) < 1.4);
  add('finishPoison', 'Bad Dinner', 25, kind === 'Milk' || kind === 'Grapes');
  add('finishSweet', 'Sweet Tooth', 30, kind === 'Chocolate');
  return { name: styles[0]?.name || 'Final Blow', styles, coins: 35 + styles.reduce((n, s) => n + s.coins, 0) };
}
