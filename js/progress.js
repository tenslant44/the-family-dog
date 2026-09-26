// Combos (per flight) and achievements (persistent)
const PLAYER_HITS = ['Kick', 'Sprint Kick', 'Punch', 'Uppercut', 'Bat', 'Home Run', 'Throw', 'Snowball', 'Pistol'];
const KICKS = ['Kick', 'Sprint Kick'], BATS = ['Bat', 'Home Run'];
const CIV_KICKS = ['KICK', 'LAUNCH!'], CIV_BATS = ['CRACK', 'HOME RUN!'];
const before = (seq, kinds, target) => {
  const t = seq.indexOf(target);
  return t > 0 && seq.slice(0, t).some((k) => kinds.includes(k));
};
const count = (seq, k) => seq.filter((x) => x === k).length;

// c = { L, seq, out, dist, pos }
export const COMBOS = [
  { id: 'kickcar', name: 'Kick-Car Special', bonus: 25, hint: 'Kick it into traffic.', test: (c) => before(c.seq, KICKS, 'Traffic') },
  { id: 'hitrun', name: 'Hit and Run', bonus: 30, hint: 'Bat it into traffic.', test: (c) => before(c.seq, BATS, 'Traffic') },
  { id: 'delivery', name: 'Express Delivery', bonus: 30, hint: 'Throw it into traffic.', test: (c) => before(c.seq, ['Throw'], 'Traffic') },
  { id: 'upexpress', name: 'Uppercut Express', bonus: 30, hint: 'Uppercut it into traffic.', test: (c) => before(c.seq, ['Uppercut'], 'Traffic') },
  { id: 'guncar', name: 'Drive-By', bonus: 35, hint: 'Shoot it into traffic.', test: (c) => before(c.seq, ['Pistol'], 'Traffic') },
  { id: 'assist', name: 'Traffic Assist', bonus: 15, hint: 'Anything, then a car.', test: (c) => c.seq.indexOf('Traffic') > 0 && !before(c.seq, [...KICKS, ...BATS, 'Throw', 'Uppercut', 'Pistol'], 'Traffic') },
  { id: 'rushhour', name: 'Rush Hour', bonus: 50, hint: 'Two cars, one flight.', test: (c) => count(c.seq, 'Traffic') >= 2 },
  { id: 'juggler', name: 'Juggler', bonus: 20, hint: 'Hit it 3 times before it lands.', test: (c) => c.L.hits >= 3 },
  { id: 'doubletap', name: 'Double Tap', bonus: 10, hint: 'Same hit twice in a row, mid-air.', test: (c) => c.seq.some((k, i) => i > 0 && k === c.seq[i - 1] && PLAYER_HITS.includes(k)) },
  { id: 'spike', name: 'Volleyball Spike', bonus: 25, hint: 'Uppercut, then kick or bat it on the way down.', test: (c) => c.seq.some((k, i) => i > 0 && c.seq[i - 1] === 'Uppercut' && [...KICKS, ...BATS].includes(k)) },
  { id: 'shootstar', name: 'Shooting Star', bonus: 25, hint: 'Shoot it after an uppercut.', test: (c) => before(c.seq, ['Uppercut'], 'Pistol') },
  { id: 'gunbat', name: 'Bullet and Bat', bonus: 25, hint: 'Shoot it, then hit it with a bat.', test: (c) => c.seq.some((k, i) => i > 0 && BATS.includes(k) && c.seq.slice(0, i).includes('Pistol')) },
  { id: 'triple', name: 'Triple Tap', bonus: 30, hint: 'Land three pistol hits in a single flight.', test: (c) => count(c.seq, 'Pistol') >= 3 },
  { id: 'pinball', name: 'Pinball', bonus: 20, hint: 'Slam it into things 3 times in one flight.', test: (c) => c.L.slams >= 3 },
  { id: 'wallbanger', name: 'Wall Banger', bonus: 15, hint: 'Smash it through a snow wall.', test: (c) => c.L.smashed >= 1 },
  { id: 'demolition', name: 'Demolition', bonus: 30, hint: 'Smash 3 snow blocks in one flight.', test: (c) => c.L.smashed >= 3 },
  { id: 'snowjob', name: 'Snow Job', bonus: 10, hint: 'Snowball it mid-flight.', test: (c) => c.seq.indexOf('Snowball') > 0 },
  { id: 'sandwich', name: 'Knuckle Sandwich', bonus: 15, hint: 'Punch it 3+ times while holding it, then throw.', test: (c) => c.seq[0] === 'Throw' && c.L.punches >= 3 },
  { id: 'tagteam', name: 'Tag Team', bonus: 20, hint: 'You and John, same flight.', test: (c) => c.seq.includes('John') && c.seq.some((k) => PLAYER_HITS.includes(k)) },
  { id: 'sticky', name: 'Sticky Situation', bonus: 20, hint: 'Glue it, then launch it into a wall.', test: (c) => c.L.wallStuck },
  { id: 'pool', name: 'Pool Party', bonus: 25, hint: 'Land it in the kiddie pool.', test: (c) => Math.hypot(c.pos.x + 3, c.pos.z - 7) < 1.4 },
  { id: 'hangtime', name: 'Hang Time', bonus: 15, hint: 'Keep it airborne for 3 seconds.', test: (c) => c.L.t > 3 },
  { id: 'skyhigh', name: 'Sky High', bonus: 20, hint: 'Get it 25 m up without an uppercut.', test: (c) => c.L.maxH > 25 && !c.seq.includes('Uppercut') },
  { id: 'bullseye', name: 'Special Order', bonus: 40, hint: 'Land it at the stand across the street.', test: (c) => Math.hypot(c.pos.x - 4, c.pos.z - 33) < 2.8 },
  { id: 'boomerang', name: 'Boomerang', bonus: 15, hint: 'Long flight, lands right where it started.', test: (c) => c.L.t > 1.8 && c.dist < 2.5 },
  { id: 'fenceline', name: 'Over The Fence', bonus: 10, hint: 'Clear the fence with a throw.', test: (c) => c.seq[0] === 'Throw' && c.out },
  { id: 'dogTramp', name: 'Bounce House', bonus: 20, hint: 'Bounce the dog on the yard trampoline.', test: c => c.seq.includes('Trampoline') },
  { id: 'dogPedestrian', name: 'Pedestrian Pinball', bonus: 25, hint: 'Launch the dog into a pedestrian.', test: c => c.seq.includes('Pedestrian') },
  { id: 'dogBike', name: 'Bike Lane Bowling', bonus: 25, hint: 'Launch the dog into an e-bike.', test: c => c.seq.includes('E-Bike') },
  { id: 'dogTwoPeople', name: 'Crowd Surfing', bonus: 40, hint: 'Hit two pedestrians with the dog in one flight.', test: c => count(c.seq, 'Pedestrian') >= 2 },
];

// A civilian flight begins with a hit or throw and ends when the pedestrian comes to rest.
export const CIV_COMBOS = [
  { id: 'civKickCar', name: 'Curbside Delivery', bonus: 25, hint: 'Kick a pedestrian into traffic.', test: c => before(c.seq, CIV_KICKS, 'Traffic') },
  { id: 'civThrowCar', name: 'Express Passenger', bonus: 30, hint: 'Throw a pedestrian into traffic.', test: c => before(c.seq, ['Throw'], 'Traffic') },
  { id: 'civBatCar', name: 'Bat and Dash', bonus: 35, hint: 'Bat a pedestrian into traffic.', test: c => before(c.seq, CIV_BATS, 'Traffic') },
  { id: 'civUpper', name: 'Air Mail', bonus: 25, hint: 'Uppercut a pedestrian 10 m high.', test: c => c.seq.includes('UPPERCUT') && c.flight.maxH >= 10 },
  { id: 'civWindow', name: 'Window Shopper', bonus: 25, hint: 'Send a pedestrian through a window.', test: c => c.seq.includes('Window') },
  { id: 'civWindowThrow', name: 'Special Delivery', bonus: 30, hint: 'Throw a pedestrian into a house window.', test: c => c.seq[0] === 'Throw' && c.seq.includes('Window') },
  { id: 'civBombCar', name: 'Explosive Commute', bonus: 35, hint: 'Blast a pedestrian into traffic.', test: c => before(c.seq, ['Bomb'], 'Traffic') },
  { id: 'civSnowCar', name: 'Slush Hour', bonus: 30, hint: 'Snowball a pedestrian before a car hits them.', test: c => before(c.seq, ['Snowball'], 'Traffic') },
  { id: 'civDogCar', name: 'Dog, Then Driver', bonus: 40, hint: 'Hit a pedestrian with the dog, then a car.', test: c => before(c.seq, ['Dog Collision'], 'Traffic') },
  { id: 'civTramp', name: 'Sidewalk Acrobat', bonus: 20, hint: 'Bounce a pedestrian on your trampoline.', test: c => c.seq.includes('Trampoline') },
  { id: 'civTriple', name: 'Three-Point Turn', bonus: 30, hint: 'Hit a pedestrian three times in one flight.', test: c => c.flight.hits >= 3 },
  { id: 'civDoubleCar', name: 'Double Parked', bonus: 45, hint: 'Have two cars hit a pedestrian before landing.', test: c => count(c.seq, 'Traffic') >= 2 },
  { id: 'civWall', name: 'Concrete Conversation', bonus: 25, hint: 'Slam a pedestrian into solid objects twice in one flight.', test: c => c.flight.slams >= 2 },
  { id: 'civHang', name: 'Long Weekend', bonus: 20, hint: 'Keep a pedestrian airborne over three seconds.', test: c => c.flight.t >= 3 },
  { id: 'civHeldPunch', name: 'Carry-On Baggage', bonus: 30, hint: 'Punch a held pedestrian three times, then throw them.', test: c => c.seq[0] === 'Throw' && c.flight.punches >= 3 },
  { id: 'civAirSnow', name: 'Cold Reception', bonus: 20, hint: 'Snowball a pedestrian already airborne.', test: c => c.seq.indexOf('Snowball') > 0 },
  { id: 'civMotherRoad', name: 'Mom on the Move', bonus: 25, hint: 'Send a complaining mother into traffic.', test: c => c.kind === 'mother' && c.seq.includes('Traffic') },
  { id: 'civHumanBowling', name: 'Human Bowling', bonus: 30, hint: 'Throw a civilian into another civilian.', test: c => before(c.seq, ['Throw'], 'Civilian Collision') },
  { id: 'civDoubleBowling', name: 'Double Strike', bonus: 45, hint: 'Hit two civilians during a single civilian flight.', test: c => count(c.seq, 'Civilian Collision') >= 2 },
  { id: 'civMotherBowling', name: 'Mother of All Hits', bonus: 35, hint: 'Send a mother flying into another civilian.', test: c => c.kind === 'mother' && c.seq.includes('Civilian Collision') },
  { id: 'civBowlingCar', name: 'Sidewalk to Street', bonus: 40, hint: 'Hit a civilian with a thrown civilian, then get hit by a car.', test: c => before(c.seq, ['Civilian Collision'], 'Traffic') },
  { id: 'civBikeStrike', name: 'Bike Lane Strike', bonus: 30, hint: 'Throw a civilian into an e-bike rider.', test: c => before(c.seq, ['Throw'], 'E-Bike Rider') },
  { id: 'civBikeCar', name: 'Bike Lane Detour', bonus: 40, hint: 'Hit an e-bike rider with a civilian, then hit traffic.', test: c => before(c.seq, ['E-Bike Rider'], 'Traffic') },
  { id: 'civRiderStrike', name: 'Rider Delivery', bonus: 30, hint: 'Throw an e-bike rider into a civilian.', test: c => c.seq.includes('Rider Collision') },
  { id: 'civRiderMom', name: 'Family Reunion', bonus: 35, hint: 'Throw an e-bike rider into a mother.', test: c => c.kind === 'mother' && c.seq.includes('Rider Collision') },
  { id: 'civRiderTraffic', name: 'Passenger Transfer', bonus: 40, hint: 'Hit a civilian with a thrown rider, then a car.', test: c => before(c.seq, ['Rider Collision'], 'Traffic') },
  { id: 'civHeadThrow', name: 'Head First', bonus: 30, hint: 'Throw a civilian after grabbing them by the head.', test: c => c.seq.includes('Throw') && c.seq.includes('Head Grab') },
  { id: 'civHeadCar', name: 'Head Start', bonus: 40, hint: 'Head-grab throw a civilian into traffic.', test: c => before(c.seq, ['Head Grab'], 'Traffic') },
];

export const ACH = [
  { id: 'liftoff', name: 'Liftoff', desc: 'Launch the dog out of the yard.' },
  { id: 'flyer50', name: 'Frequent Flyer', desc: 'Launch it 50 m.' },
  { id: 'orbit', name: 'Orbit', desc: 'Launch it 100 m.' },
  { id: 'sky', name: 'Stratosphere', desc: 'Uppercut it 30 m high.' },
  { id: 'srank', name: 'S Rank', desc: 'Get an S grade or better.' },
  { id: 'lookboth', name: "Didn't Look Both Ways", desc: 'Get the dog hit by a car.' },
  { id: 'kickcar', name: 'Kick-Car Special', desc: 'Kick the dog into traffic.' },
  { id: 'rushhour', name: 'Rush Hour', desc: 'Two cars, one flight.' },
  { id: 'jaywalker', name: 'Jaywalker', desc: 'Get hit by a car yourself.' },
  { id: 'frogger', name: 'Frogger', desc: 'Get hit by cars 5 times.' },
  { id: 'matador', name: 'Matador', desc: 'Survive 10 close calls.' },
  { id: 'juggler', name: 'Juggler', desc: 'Land a 3-hit air combo.' },
  { id: 'combo3', name: 'Combo Master', desc: 'Land 3 named combos in one flight.' },
  { id: 'collector', name: 'Combo Collector', desc: 'Discover 10 different combos.' },
  { id: 'completionist', name: 'Seen It All', desc: 'Discover every combo.' },
  { id: 'pinball', name: 'Pinball Wizard', desc: 'Slam it into things 3 times in one flight.' },
  { id: 'yeet', name: 'Special Delivery', desc: 'Throw the dog out of the yard.' },
  { id: 'sandwich', name: 'Knuckle Sandwich', desc: 'Punch it 3+ times while holding it, then throw.' },
  { id: 'knew', name: 'You Knew This Would Happen', desc: 'Let an angry dog break free.' },
  { id: 'soft', name: 'Soft Spot', desc: 'Kiss the dog 10 times.' },
  { id: 'goodboy', name: 'Good Boy (Allegedly)', desc: 'Pet the dog 50 times.' },
  { id: 'bought', name: 'Bought Its Love', desc: 'Feed it chocolate.' },
  { id: 'science', name: 'Science', desc: "Find out if it's lactose intolerant." },
  { id: 'fishdown', name: 'Fish Down', desc: 'Get John the Fish knocked out.' },
  { id: 'fort', name: 'Fort Knox', desc: 'Build 25 snow blocks.' },
  { id: 'snowjob', name: 'Snow Job', desc: 'Snowball the dog mid-flight.' },
  { id: 'nobody', name: "Nobody's Cleaning That", desc: 'Witness 5 poops.' },
  { id: 'beatup', name: 'Beat Up By A Dog', desc: 'Get knocked out by the dog.' },
  { id: 'regular', name: 'Stand Regular', desc: 'Earn 500 coins total.' },
  { id: 'tycoon', name: 'Dog Tycoon', desc: 'Earn 3000 coins total.' },
  { id: 'seasons', name: 'Four Seasons', desc: 'Play in every season.' },
  { id: 'pool', name: 'Pool Party', desc: 'Land the dog in the kiddie pool.' },
  { id: 'sticky', name: 'Sticky Situation', desc: 'Launch a glued dog into a wall.' },
  { id: 'nature', name: 'Nature Documentary', desc: 'Watch the dog snap at 10 bugs.' },
  { id: 'hangtime', name: 'Hang Time', desc: 'Keep the dog airborne for 3 seconds.' },
  { id: 'bullseye', name: 'Special Order', desc: 'Land the dog at the stand across the street.' },
  { id: 'armed', name: 'New Toy', desc: 'Buy the pistol from the stand.' },
  { id: 'firstshot', name: 'First Shot', desc: 'Land a pistol hit.' },
  { id: 'skeet', name: 'Skeet Shooter', desc: 'Shoot the dog while it is airborne.' },
  { id: 'longshot', name: 'Long Shot', desc: 'Land a pistol hit from 25 m away.' },
  { id: 'gunslinger', name: 'Gunslinger', desc: 'Land 25 pistol hits.' },
  { id: 'shootstar', name: 'Shooting Star', desc: 'Shoot it after an uppercut.' },
  { id: 'triple', name: 'Triple Tap', desc: 'Land three pistol hits in one flight.' },
  { id: 'guncar', name: 'Drive-By', desc: 'Shoot the dog into traffic.' },
  { id: 'firstFinish', name: 'Final Blow', desc: 'Defeat the dog for the first time.' },
  { id: 'finish10', name: 'Repeat Offender', desc: 'Defeat the dog 10 times.' },
  { id: 'finish50', name: 'The Usual', desc: 'Defeat the dog 50 times.' },
  { id: 'finishShot', name: 'Final Shot', desc: 'Finish with the pistol.' },
  { id: 'finishFar', name: 'Long Shot Finish', desc: 'Finish with a pistol shot from 25 m away.' },
  { id: 'finishCar', name: 'Roadkill', desc: 'Defeat the dog after a car hit.' },
  { id: 'finishAir', name: 'Airborne Finish', desc: 'Defeat the dog mid-flight.' },
  { id: 'finishSky', name: 'Skyfall', desc: 'Finish with a collision after reaching 15 m.' },
  { id: 'finishCombo', name: 'Combo Finisher', desc: 'Finish a flight with 3 or more hits.' },
  { id: 'finishSnow', name: 'Snow Demolition', desc: 'Smash a snow wall on a finishing flight.' },
  { id: 'finishBat', name: 'Batter Up', desc: 'Finish with a bat.' },
  { id: 'finishSpike', name: 'Spike and Strike', desc: 'Uppercut, then bat it on a finishing flight.' },
  { id: 'finishPool', name: 'Poolside', desc: 'Finish in the kiddie pool.' },
  { id: 'finishPoison', name: 'Bad Dinner', desc: 'Finish with milk or grapes.' },
  { id: 'finishSweet', name: 'Sweet Tooth', desc: 'Finish with chocolate.' },
  { id: 'finishPeta', name: 'PETA Approved', desc: 'Finish the dog at a bunker station.' },
  { id: 'finishWindow', name: 'Window Dive', desc: 'Finish the dog with a fall from an upstairs window.' },
  { id: 'finishBomb', name: 'Kaboom', desc: 'Finish the dog with an explosive.' },
  { id: 'bikeYank', name: 'Get Off That Thing', desc: 'Pull an e-bike rider off their bike.' },
  { id: 'bikeDog', name: 'Dog vs. E-Bike', desc: 'Launch the dog into a rider.' },
  { id: 'bikeThief', name: 'Joyride', desc: 'Take an unattended e-bike for a ride.' },
  { id: 'bikeCollector', name: 'Two-Wheel Collector', desc: 'Ride both e-bikes.' },
  { id: 'bikeCentury', name: 'Century Ride', desc: 'Ride a stolen e-bike 100 meters in one trip.' },
  { id: 'bikeRoad', name: 'Wrong Lane', desc: 'Ride an e-bike into the road.' },
  { id: 'bikeKnock5', name: 'Sidewalk Sweep', desc: 'Dismount riders five times.' },
  { id: 'dogPeople', name: 'Human Bowling', desc: 'Throw the dog into a pedestrian.' },
  { id: 'dogPeople5', name: 'Strike!', desc: 'Knock pedestrians over with the dog five times.' },
  { id: 'dogTramp', name: 'Bounce House', desc: 'Bounce the dog on the yard trampoline.' },
  { id: 'dogPedestrian', name: 'Pedestrian Pinball', desc: 'Launch the dog into a pedestrian.' },
  { id: 'dogBike', name: 'Bike Lane Bowling', desc: 'Launch the dog into an e-bike.' },
  { id: 'dogTwoPeople', name: 'Crowd Surfing', desc: 'Hit two pedestrians with the dog in one flight.' },
  { id: 'civilianFirst', name: 'Wrong Place, Wrong Time', desc: 'Hit a pedestrian for the first time.' },
  { id: 'civilian10', name: 'Street Regular', desc: 'Land 10 hits on pedestrians.' },
  { id: 'civilian50', name: 'Town Menace', desc: 'Land 50 hits on pedestrians.' },
  { id: 'civilianMoms', name: 'Mom Problems', desc: 'Hit three complaining mothers.' },
  { id: 'civilianPistol', name: 'Warning Shot?', desc: 'Hit a pedestrian with the pistol.' },
  { id: 'civilianSnow', name: 'Snowball Fight', desc: 'Hit a pedestrian with a snowball.' },
  { id: 'civilianBomb', name: 'Blast Radius', desc: 'Send a pedestrian flying with a bomb.' },
  { id: 'civilianTraffic', name: 'Crosswalk Chaos', desc: 'Get a pedestrian hit by a car.' },
  { id: 'civilianWindow', name: 'Broken Glass', desc: 'Send a pedestrian through a house window.' },
  { id: 'civilianHighWindow', name: 'Top Floor Exit', desc: 'Send a pedestrian through an upstairs window.' },
  { id: 'civilianPoop', name: 'Eyes Closed', desc: 'Blind a pedestrian with thrown poop.' },
  { id: 'civilianPoop5', name: 'Brownout', desc: 'Blind five pedestrians with thrown poop.' },
  { id: 'civilianChat', name: 'Local Knowledge', desc: 'Talk to a pedestrian.' },
  { id: 'civilianChat10', name: 'Everybody Knows You', desc: 'Hear 10 pedestrians talk to you.' },
  { id: 'civilianMomChat', name: 'Parenting Advice', desc: 'Hear a mother complain about her kids.' },
  { id: 'civilianPet', name: 'Awkward Hello', desc: 'Try to pet a pedestrian.' },
  { id: 'civilianKiss', name: 'Uninvited Smooch', desc: 'Try to kiss a pedestrian.' },
  { id: 'civilianPetDog5', name: 'Dog Fan Club', desc: 'Watch pedestrians pet the dog five times.' },
  { id: 'civilianWitness', name: 'Public Spectacle', desc: 'Get noticed by a pedestrian during a fight.' },
  { id: 'civilianMomScold', name: 'Mom Says Stop', desc: 'Get scolded by a complaining mother.' },
  { id: 'civilianShoved', name: 'Sidewalk Justice', desc: 'Get shoved by an angry pedestrian.' },
  { id: 'civilianRecord', name: 'Caught on Camera', desc: 'Get filmed by a pedestrian.' },
  { id: 'civilianRecord10', name: 'Going Viral', desc: 'Get filmed 10 times.' },
  { id: 'civilianScold', name: 'Mind Your Business', desc: 'Get told to stop by a pedestrian.' },
  { id: 'civilianKnockout', name: 'Lights Out', desc: 'Knock out an adult pedestrian.' },
  { id: 'civilianKnockout10', name: 'Out Cold x10', desc: 'Knock out 10 adult pedestrians.' },
  { id: 'civilianThrow', name: 'Unscheduled Flight', desc: 'Throw a pedestrian.' },
  { id: 'civilianLongThrow', name: 'Frequent Passenger', desc: 'Send a pedestrian 20 m in one flight.' },
  { id: 'civilianCombo', name: 'Local Legend', desc: 'Discover a civilian combo.' },
  { id: 'civilianCombo5', name: 'Neighborhood Tour', desc: 'Discover five different civilian combos.' },
  { id: 'civilianComboAll', name: 'Town Completionist', desc: 'Discover every civilian combo.' },
  { id: 'softDogBlind', name: 'Soft Focus', desc: 'Blind the dog with soft poop.' },
  { id: 'hardDogBlind', name: 'Hard Focus', desc: 'Blind the dog with hard poop.' },
  { id: 'softRoadTrap', name: 'Roadside Surprise', desc: 'Place soft poop in the road.' },
  { id: 'firstSpinout', name: 'Spin Cycle', desc: 'Make a car spin out on soft poop.' },
  { id: 'fiveSpinouts', name: 'Slippery Street', desc: 'Spin out five cars on soft poop.' },
  { id: 'yogurtMemory', name: 'Obese Sonic Memories', desc: 'Make the dog sad with yogurt.' },
  { id: 'trampolineDog', name: 'Dog Bounce', desc: 'Bounce the dog on your trampoline.' },
  { id: 'trampolineCivilian', name: 'Passenger Bounce', desc: 'Bounce a pedestrian on your trampoline.' },
  { id: 'trampolinePlayer', name: 'Self Bounce', desc: 'Bounce yourself on your trampoline.' },
  { id: 'allPetaStations', name: 'Full Tour', desc: 'Try all nine bunker stations.' },
  { id: 'bikeMarathon', name: 'Bike Marathon', desc: 'Ride an e-bike 500 meters in one trip.' },
  { id: 'bikeKnock10', name: 'Bike Rack', desc: 'Dismount riders ten times.' },
  { id: 'bombCrowd', name: 'Block Party', desc: 'Send two pedestrians flying with one bomb.' },
  { id: 'bombBike', name: 'Flat Tire', desc: 'Knock a rider off with an explosion.' },
  { id: 'civilianToCivilian', name: 'Human Pinball', desc: 'Launch one civilian into another.' },
  { id: 'civilianToCivilian10', name: 'Ten-Pin Town', desc: 'Land ten civilian-to-civilian impacts.' },
  { id: 'civilianMultiStrike', name: 'Crowd Control', desc: 'Hit two civilians in one civilian flight.' },
  { id: 'civilianMotherCollision', name: 'Mom Collision', desc: 'Include a mother in a civilian-to-civilian collision.' },
  { id: 'civilianToRider', name: 'Sidewalk Cyclone', desc: 'Launch a civilian into an e-bike rider.' },
  { id: 'civilianToRider5', name: 'Bike Lane Sweep', desc: 'Hit e-bike riders with civilians five times.' },
  { id: 'bikeRiderGrab', name: 'Rider in Hand', desc: 'Pick up a dismounted e-bike rider.' },
  { id: 'bikeRiderThrow', name: 'Airborne Cyclist', desc: 'Throw an e-bike rider.' },
  { id: 'bikeRiderThrow10', name: 'Frequent Rider', desc: 'Throw riders ten times.' },
  { id: 'riderToCivilian', name: 'Rider Strike', desc: 'Throw an e-bike rider into a civilian.' },
  { id: 'riderToCivilian5', name: 'Rider Five', desc: 'Hit civilians with thrown riders five times.' },
  { id: 'riderHitsMother', name: 'Mom, Look Out!', desc: 'Hit a mother with a thrown rider.' },
  { id: 'petaDog', name: 'Bunker Visitor', desc: 'Use a bunker station with the dog.' },
  { id: 'petaDog10', name: 'Frequent Visitor', desc: 'Use bunker stations with dogs ten times.' },
  { id: 'petaCivilian', name: 'Human Tour', desc: 'Take an adult civilian through a bunker station.' },
  { id: 'petaCivilian5', name: 'Tour Guide', desc: 'Take five civilians through bunker stations.' },
  { id: 'petaMother', name: 'Parent Tour', desc: 'Take a mother through a bunker station.' },
  { id: 'petaShredder', name: 'Paper Shredder?', desc: 'Try the new shredder room.' },
  { id: 'petaGrinder', name: 'Burger Factory', desc: 'Try the new grinder room.' },
  { id: 'petaBurger', name: 'Mystery Lunch', desc: 'Collect a burger from the grinder.' },
  { id: 'petaBurger5', name: 'Five Burgers', desc: 'Run the grinder five times.' },
  { id: 'petaBoth', name: 'Open to Everyone', desc: 'Take both a dog and a civilian through the bunker.' },
  ...[
    ['saw', 'Saw Station'], ['inject', 'Injection Station'], ['rad', 'Radiation Station'],
    ['spike', 'Spike Station'], ['press', 'Press Station'], ['zap', 'Electric Station'],
    ['anvil', 'Anvil Station'], ['shredder', 'Shredder Station'], ['grinder', 'Grinder Station'],
  ].map(([id, name]) => ({ id: `petaStation_${id}`, name, desc: `Try the ${name.toLowerCase()} in the bunker.` })),
  { id: 'burgerSuspicious', name: 'They Know', desc: 'Feed a burger to a civilian who suspects something.' },
  { id: 'burgerUnaware', name: 'No Questions Asked', desc: 'Feed a burger to an unsuspecting civilian.' },
  { id: 'burgerMother', name: 'Mom Eats Lunch', desc: 'Feed a burger to a mother.' },
  { id: 'burgerRider', name: 'Roadside Snack', desc: 'Feed a burger to an e-bike rider.' },
  { id: 'burgerDog', name: 'Dog Dinner', desc: 'Feed a burger to the dog.' },
  { id: 'burgerJohn', name: 'Fish Food?', desc: 'Offer John a burger.' },
  { id: 'burgerSelf', name: 'Taste Test', desc: 'Eat a burger yourself.' },
  { id: 'burgerChef', name: 'Burger Chef', desc: 'Serve ten burgers.' },
  { id: 'headGrabDog', name: 'Dog by the Head', desc: 'Grab the dog by the head.' },
  { id: 'headGrabCivilian', name: 'Head Handle', desc: 'Grab an adult civilian by the head.' },
  { id: 'headGrabRider', name: 'Helmet Handle', desc: 'Grab an e-bike rider by the head.' },
  { id: 'headThrowDog', name: 'Head First Hound', desc: 'Throw a head-grabbed dog.' },
  { id: 'headThrowCivilian', name: 'Head First Citizen', desc: 'Throw a head-grabbed civilian.' },
  { id: 'headThrowRider', name: 'Helmet Toss', desc: 'Throw a head-grabbed rider.' },
  { id: 'knifeCivilian', name: 'Toy Blade', desc: 'Land a toy knife move on an adult.' },
  { id: 'knifeStab', name: 'Stab Move', desc: 'Use the cartoon stab move.' },
  { id: 'knifeSlice', name: 'Slice Move', desc: 'Use the cartoon slice move.' },
  ...CIV_COMBOS.map(c => ({ id: c.id, name: c.name, desc: c.hint })),
];
const STAT_ACH = { pets: [50, 'goodboy'], kisses: [10, 'soft'], nearMiss: [10, 'matador'], blocks: [25, 'fort'], poops: [5, 'nobody'], bugSnaps: [10, 'nature'], carHitsMe: [5, 'frogger'], pistolHits: [25, 'gunslinger'], bikeKnockoffs: [5, 'bikeKnock5'], dogPeopleHits: [5, 'dogPeople5'] };
const COMBO_ACH = ['kickcar', 'rushhour', 'juggler', 'pinball', 'sandwich', 'snowjob', 'pool', 'sticky', 'hangtime', 'bullseye', 'shootstar', 'triple', 'guncar', 'dogTramp', 'dogPedestrian', 'dogBike', 'dogTwoPeople'];

export function createProgress({ save, persist, play }) {
  save.ach = save.ach || {};
  save.stats = save.stats || {};
  save.combos = save.combos || {};
  save.civilianCombos = save.civilianCombos || {};
  save.earned = save.earned || 0;
  save.seenSeasons = save.seenSeasons || {};
  const banner = document.getElementById('ach');
  const queue = [];
  let showing = false;
  function next() {
    if (showing || !queue.length) return;
    showing = true;
    const a = queue.shift();
    banner.innerHTML = `<div class="k">${a.kind}</div><div class="n">${a.name}</div><div class="d">${a.desc}</div>`;
    banner.classList.add('on');
    play('achieve', 0.7);
    setTimeout(() => { banner.classList.remove('on'); setTimeout(() => { showing = false; next(); }, 400); }, 3200);
  }
  function unlock(id) {
    if (save.ach[id]) return;
    const a = ACH.find((x) => x.id === id);
    if (!a) return;
    save.ach[id] = Date.now(); persist();
    queue.push({ kind: 'ACHIEVEMENT UNLOCKED', name: a.name, desc: a.desc });
    next();
  }
  function stat(key, n = 1) {
    const v = (save.stats[key] || 0) + n;
    save.stats[key] = v; persist();
    const t = STAT_ACH[key];
    if (t && v >= t[0]) unlock(t[1]);
    return v;
  }
  function finishStat() {
    const total = stat('finishes');
    unlock('firstFinish');
    if (total >= 10) unlock('finish10');
    if (total >= 50) unlock('finish50');
    return total;
  }
  function addCoins(n) {
    save.coins += n; save.earned += n; persist();
    if (save.earned >= 500) unlock('regular');
    if (save.earned >= 3000) unlock('tycoon');
  }
  function seasonSeen(s) {
    save.seenSeasons[s] = 1; persist();
    if (['default', 'spring', 'summer', 'winter'].every((k) => save.seenSeasons[k])) unlock('seasons');
  }
  // returns [{id,name,bonus,isNew}]
  function findCombos(c) {
    const found = [];
    for (const k of COMBOS) {
      let ok = false;
      try { ok = k.test(c); } catch { ok = false; }
      if (!ok) continue;
      const isNew = !save.combos[k.id];
      save.combos[k.id] = (save.combos[k.id] || 0) + 1;
      found.push({ id: k.id, name: k.name, bonus: k.bonus, isNew });
      if (COMBO_ACH.includes(k.id)) unlock(k.id);
    }
    if (found.length) {
      persist();
      if (found.length >= 3) unlock('combo3');
      const n = Object.keys(save.combos).length;
      if (n >= 10) unlock('collector');
      if (n >= COMBOS.length) unlock('completionist');
      for (const f of found) if (f.isNew) queue.push({ kind: 'NEW COMBO', name: f.name, desc: COMBOS.find((k) => k.id === f.id).hint });
      next();
    }
    return found;
  }
  function civilianHit(person, kind) {
    const hits = stat('civilianHits');
    unlock('civilianFirst');
    if (hits >= 10) unlock('civilian10');
    if (hits >= 50) unlock('civilian50');
    if (person.kind === 'mother' && stat('civilianMotherHits') >= 3) unlock('civilianMoms');
    if (kind === 'Pistol') unlock('civilianPistol');
    if (kind === 'Snowball') unlock('civilianSnow');
    if (kind === 'Bomb') unlock('civilianBomb');
    if (kind === 'Traffic') unlock('civilianTraffic');
    if (kind === 'Throw') unlock('civilianThrow');
  }
  function civilianChat(person) {
    const n = stat('civilianChats');
    unlock('civilianChat');
    if (n >= 10) unlock('civilianChat10');
    if (person.kind === 'mother') unlock('civilianMomChat');
  }
  function civilianWitness(person, state) {
    unlock('civilianWitness');
    if (state === 'record' && stat('civilianRecordings') >= 10) unlock('civilianRecord10');
    if (state === 'record') unlock('civilianRecord');
    if (state === 'scold') unlock('civilianScold');
    if (state === 'scold' && person.kind === 'mother') unlock('civilianMomScold');
  }
  function civilianKo() {
    if (stat('civilianKos') >= 10) unlock('civilianKnockout10');
    unlock('civilianKnockout');
  }
  function findCivilianCombos(flight, person) {
    const seq = flight.seq, pos = person.pos;
    const c = { flight, seq, pos, kind: person.kind, dist: Math.hypot(pos.x - flight.from.x, pos.z - flight.from.z) };
    if (c.dist >= 20 && seq.includes('Throw')) unlock('civilianLongThrow');
    const found = [];
    for (const combo of CIV_COMBOS) {
      let ok = false;
      try { ok = combo.test(c); } catch { ok = false; }
      if (!ok) continue;
      const isNew = !save.civilianCombos[combo.id];
      save.civilianCombos[combo.id] = (save.civilianCombos[combo.id] || 0) + 1;
      found.push({ id: combo.id, name: combo.name, bonus: combo.bonus, isNew });
      unlock(combo.id);
    }
    if (found.length) {
      persist();
      unlock('civilianCombo');
      if (Object.keys(save.civilianCombos).length >= 5) unlock('civilianCombo5');
      if (Object.keys(save.civilianCombos).length >= CIV_COMBOS.length) unlock('civilianComboAll');
      next();
    }
    return found;
  }
  function renderPanel() {
    const got = ACH.filter((a) => save.ach[a.id]).length;
    const cg = COMBOS.filter((k) => save.combos[k.id]).length;
    const civ = CIV_COMBOS.filter(k => save.civilianCombos[k.id]).length;
    document.getElementById('achCount').textContent = `${got}/${ACH.length} achievements · ${cg + civ}/${COMBOS.length + CIV_COMBOS.length} combos`;
    document.getElementById('achList').innerHTML = ACH.map((a) => `<div class="a ${save.ach[a.id] ? 'got' : ''}"><b>${a.name}</b><span>${a.desc}</span></div>`).join('');
    document.getElementById('comboList').innerHTML = '<h3>Dog combos</h3>' + COMBOS.map((k) => save.combos[k.id]
      ? `<div class="a got"><b>${k.name} <small>+${k.bonus}</small></b><span>${k.hint} · landed x${save.combos[k.id]}</span></div>`
      : `<div class="a"><b>???</b><span>${k.hint}</span></div>`).join('') +
      '<h3>Civilian combos</h3>' + CIV_COMBOS.map(k => save.civilianCombos[k.id]
        ? `<div class="a got"><b>${k.name} <small>+${k.bonus}</small></b><span>${k.hint} · landed x${save.civilianCombos[k.id]}</span></div>`
        : `<div class="a"><b>???</b><span>${k.hint}</span></div>`).join('');
  }
  return { unlock, stat, finishStat, addCoins, seasonSeen, findCombos, findCivilianCombos, civilianHit, civilianChat, civilianWitness, civilianKo, renderPanel };
}
