/**
 * OpenTube demo dataset.
 *
 * Everything on the site is driven by this file: the feed, search, channel
 * pages, watch page metadata, comments and the "up next" rail. Clip durations
 * are the real durations of the generated MP4s in assets/video/, so the player
 * and the duration badges always agree.
 *
 * All channels, people and videos here are fictional demo content.
 */
(function () {
  'use strict';

  const channels = {
    nullbyte: {
      name: 'nullbyte',
      handle: '@nullbyte',
      avatar: 'assets/avatars/nullbyte.svg',
      subscribers: 992000,
      about:
        'Programming deep-dives with the slides left in. Compilers, runtimes and the parts of the stack everyone skips.',
      joined: '2019-04-11',
      country: 'Canada',
      links: ['github.com/nullbyte', 'nullbyte.example.dev'],
    },
    analog: {
      name: 'Analog Autopsy',
      handle: '@analogautopsy',
      avatar: 'assets/avatars/analog.svg',
      subscribers: 412000,
      about:
        'Repair benches, burnt capacitors and the occasional miracle. Vintage audio gear brought back to life.',
      joined: '2018-09-02',
      country: 'Germany',
      links: ['analogautopsy.example'],
    },
    wander: {
      name: 'Wanderfoot',
      handle: '@wanderfoot',
      avatar: 'assets/avatars/wander.svg',
      subscribers: 1280000,
      about:
        'Slow travel films. No narration, no music cues, just streets and the sound of them.',
      joined: '2017-02-18',
      country: 'Japan',
      links: ['wanderfoot.example'],
    },
    abyss: {
      name: 'Abyssal Field Notes',
      handle: '@abyssalnotes',
      avatar: 'assets/avatars/abyss.svg',
      subscribers: 2360000,
      about:
        'Marine biology from the bottom up. Every film is cut from footage logged during research cruises.',
      joined: '2020-06-30',
      country: 'United States',
      links: ['abyssalnotes.example', 'orcid.org/0000-demo'],
    },
    crumb: {
      name: 'Crumb Culture',
      handle: '@crumbculture',
      avatar: 'assets/avatars/crumb.svg',
      subscribers: 684000,
      about: 'Bread, mostly. Long ferments, simple flour and a very patient oven.',
      joined: '2021-01-08',
      country: 'United Kingdom',
      links: ['crumbculture.example'],
    },
    lowlight: {
      name: 'lowlight audio',
      handle: '@lowlightaudio',
      avatar: 'assets/avatars/lowlight.svg',
      subscribers: 3100000,
      about:
        'Instrumentals for working, reading and staring out of windows. Original loops, free to stream.',
      joined: '2016-11-23',
      country: 'Netherlands',
      links: ['lowlight.example'],
    },
    pixel: {
      name: 'Pixel Archaeology',
      handle: '@pixelarchaeology',
      avatar: 'assets/avatars/pixel.svg',
      subscribers: 918000,
      about:
        'Old games, old hardware, and the strange engineering decisions that made them work.',
      joined: '2019-10-14',
      country: 'Australia',
      links: ['pixelarchaeology.example'],
    },
    orbit: {
      name: 'Orbit Watch',
      handle: '@orbitwatch',
      avatar: 'assets/avatars/orbit.svg',
      subscribers: 1740000,
      about:
        'Launch coverage without the hype. Cameras we build, telemetry we decode, footage nobody else keeps.',
      joined: '2018-03-05',
      country: 'United States',
      links: ['orbitwatch.example'],
    },
    stride: {
      name: 'Stride Lab',
      handle: '@stridelab',
      avatar: 'assets/avatars/stride.svg',
      subscribers: 505000,
      about:
        'Endurance training logged honestly: the injuries, the spreadsheets and the long slow days.',
      joined: '2020-09-19',
      country: 'Norway',
      links: ['stridelab.example'],
    },
  };

  // clip -> length of the generated MP4 in assets/video/
  const CLIP_LENGTH = {
    code: 96,
    amber: 143,
    teal: 74,
    indigo: 188,
    rose: 121,
    street: 64,
  };

  const raw = [
    {
      id: 'v-compiler',
      title: 'Writing a compiler from scratch — the whole walkthrough',
      channel: 'nullbyte',
      thumb: 'build-compiler',
      clip: 'code',
      views: 842000,
      published: '2026-07-14',
      likes: 31200,
      category: 'Programming',
      desc:
        'A lexer, a parser and a stack machine, written in one sitting with the mistakes left in. We start from an empty file and end with something that can run a small language, then break it in all the interesting places.',
      tags: ['compilers', 'parsing', 'rust'],
      chapters: [
        [0, 'The empty file'],
        [22, 'A lexer by hand'],
        [58, 'Parsing into a tree'],
      ],
      transcript: [
        [0, "Okay, empty file. The only honest place to start a compiler video."],
        [22, 'A lexer is a loop and a match statement. That is the entire trick.'],
        [58, 'Now we need a tree. Precedence climbing is twenty lines and a headache.'],
      ],
    },
    {
      id: 'v-lexer',
      title: 'Lexers are just state machines (live coding)',
      channel: 'nullbyte',
      thumb: 'build-compiler-b',
      clip: 'code',
      views: 214000,
      published: '2026-09-27',
      likes: 9800,
      category: 'Programming',
      desc:
        'One state machine, eleven token types, and a lot of edge cases around strings and comments. Written from nothing, typed live, broken twice.',
      tags: ['lexing', 'live coding'],
      chapters: [
        [0, 'Token by token'],
        [40, 'Strings, comments and the edge cases'],
      ],
      transcript: [
        [0, 'We are going to hand-roll this, because generated lexers hide the fun part.'],
        [40, 'Escape sequences. Everyone forgets escape sequences.'],
      ],
    },
    {
      id: 'v-borrow',
      title: 'The borrow checker, explained with a parking garage',
      channel: 'nullbyte',
      thumb: 'keyboard-build',
      clip: 'code',
      views: 512000,
      published: '2026-09-02',
      likes: 24100,
      category: 'Programming',
      desc:
        'One owner per value, many readers or one writer, and nothing outlives what it points at. We draw it as a parking garage and it stops being scary.',
      tags: ['rust', 'memory'],
      chapters: [
        [0, 'One car, one ticket'],
        [32, 'Shared and exclusive'],
        [70, "Lifetimes aren't new syntax"],
      ],
      transcript: [
        [0, 'Ownership is a parking policy. The garage does not care about your feelings.'],
        [32, 'You can have a hundred people reading the sign, or one person painting it.'],
        [70, 'A lifetime annotation is documentation, not a magic spell.'],
      ],
    },
    {
      id: 'v-synth',
      title: 'Restoring a 1978 analog synth found in a barn',
      channel: 'analog',
      thumb: 'synth-restore',
      clip: 'amber',
      views: 2140000,
      published: '2026-04-21',
      likes: 96300,
      category: 'Music',
      desc:
        'Forty years of dust, one dead power supply and a keyboard full of rust. Six weekends of work, condensed, ending with the first sound out of the speakers.',
      tags: ['synth', 'restoration', 'repair'],
      chapters: [
        [0, 'What came out of the barn'],
        [38, 'Rebuilding the power supply'],
        [92, 'First power-on'],
      ],
      transcript: [
        [0, 'This has been sitting in a barn since roughly 1989. Look at the keys.'],
        [38, 'The supply is a fire hazard, so that gets rebuilt before anything else.'],
        [92, 'Here goes. Volume up — if this hums, we have work to do.'],
      ],
    },
    {
      id: 'v-ladder',
      title: 'How a ladder filter actually shapes sound',
      channel: 'analog',
      thumb: 'synth-restore-b',
      clip: 'amber',
      views: 431000,
      published: '2026-06-08',
      likes: 18300,
      category: 'Music',
      desc:
        'Four poles, one feedback loop and the reason analog filters sound like they are alive. We sweep the same note through a scope so you can hear the difference.',
      tags: ['filters', 'synthesis', 'electronics'],
      chapters: [
        [0, 'Four poles'],
        [46, 'Feedback and saturation'],
      ],
      transcript: [
        [0, 'Every stage takes another 6 dB per octave off the top end.'],
        [46, 'The feedback path is where the character comes from.'],
      ],
    },
    {
      id: 'v-kyoto',
      title: 'Kyoto at dusk — a quiet walking tour',
      channel: 'wander',
      thumb: 'kyoto-dusk',
      clip: 'teal',
      views: 3410000,
      published: '2026-05-30',
      likes: 142000,
      category: 'Travel',
      desc:
        'Lanterns, wet stone and a pagoda on the skyline. Recorded on a single evening walk, no cuts, no narration — headphones recommended.',
      tags: ['kyoto', 'ambience', '4k'],
      chapters: [
        [0, 'The lane'],
        [40, 'Under the lanterns'],
      ],
      transcript: [
        [0, 'Ambient audio only. The rain starts about halfway through.'],
        [40, 'That is a temple bell, not a train.'],
      ],
    },
    {
      id: 'v-alley',
      title: 'The narrowest alley in Kyoto',
      channel: 'wander',
      thumb: 'kyoto-dusk-b',
      clip: 'teal',
      views: 908000,
      published: '2026-08-16',
      likes: 31500,
      category: 'Travel',
      desc:
        'Two buildings, one meter apart, and a whole street that lives in the gap. We walk it at closing time when the shops turn their lights off.',
      tags: ['kyoto', 'walking tour'],
      chapters: [
        [0, 'One meter wide'],
        [34, 'Closing time'],
      ],
      transcript: [
        [0, 'You can touch both walls without trying.'],
        [34, 'The alley closes at nine. We are two minutes early.'],
      ],
    },
    {
      id: 'v-abyss',
      title: '4,000 meters down: what lives in the midnight zone',
      channel: 'abyss',
      thumb: 'deep-sea',
      clip: 'indigo',
      views: 5820000,
      published: '2026-03-12',
      likes: 284000,
      category: 'Science',
      desc:
        'Below 1,000 meters there is no sunlight at all, and yet the water is full of animals. Footage from three research cruises, annotated with what the tags recorded.',
      tags: ['ocean', 'biology', 'documentary'],
      chapters: [
        [0, 'Lights off'],
        [52, 'The jelly layer'],
        [118, 'What the tags recorded'],
      ],
      transcript: [
        [0, 'At this depth the sub is the only light source, and we keep it off.'],
        [52, 'This is not a plant. This is an animal the size of a bus.'],
        [118, 'The tag says it came up 300 meters overnight, every night.'],
      ],
    },
    {
      id: 'v-glow',
      title: "Bioluminescence is the ocean's private language",
      channel: 'abyss',
      thumb: 'deep-sea-b',
      clip: 'indigo',
      views: 1610000,
      published: '2026-07-29',
      likes: 77400,
      category: 'Science',
      desc:
        'Almost everything down there can make light, and almost nothing can explain why two species bother. We look at the best guesses and the experiments behind them.',
      tags: ['bioluminescence', 'ocean'],
      chapters: [
        [0, 'Making light cheaply'],
        [64, 'False signals'],
      ],
      transcript: [
        [0, 'Two chemicals and a protein. It is cheaper than swimming away.'],
        [64, 'Some of these flashes are bait, and some are a warning.'],
      ],
    },
    {
      id: 'v-sourdough',
      title: '18 hours, four ingredients: the sourdough method',
      channel: 'crumb',
      thumb: 'sourdough',
      clip: 'amber',
      views: 1140000,
      published: '2026-02-19',
      likes: 52600,
      category: 'Food',
      desc:
        'Flour, water, salt and time. The full method with the timings that actually matter, plus the two mistakes that turn a good loaf into a flat one.',
      tags: ['bread', 'fermentation', 'baking'],
      chapters: [
        [0, 'Feeding the starter'],
        [44, 'Stretch and fold'],
        [96, 'The bake'],
      ],
      transcript: [
        [0, 'This starter is eight years old and has been left alone for a month.'],
        [44, 'Wet your hands, not the dough. It sticks less.'],
        [96, 'Twenty minutes lid on, twenty off. Listen for the crackle.'],
      ],
    },
    {
      id: 'v-starter',
      title: 'Reviving a dead sourdough starter',
      channel: 'crumb',
      thumb: 'sourdough-b',
      clip: 'amber',
      views: 642000,
      published: '2026-08-05',
      likes: 26800,
      category: 'Food',
      desc:
        'A grey jar from the back of the fridge, a week of feeding, and the smell test that tells you whether it is worth saving.',
      tags: ['starter', 'bread'],
      chapters: [
        [0, 'What dead looks like'],
        [52, 'Feeding schedule'],
      ],
      transcript: [
        [0, 'There is liquid on top and it smells like nail polish. Good start.'],
        [52, 'Twice a day, equal weights, warm spot. That is the whole protocol.'],
      ],
    },
    {
      id: 'v-lofi',
      title: 'lofi beats to debug to — single take',
      channel: 'lowlight',
      thumb: 'lofi-room',
      clip: 'indigo',
      views: 12600000,
      published: '2026-06-21',
      likes: 512000,
      category: 'Music',
      desc:
        'One loop, recorded in one pass at three in the morning. No drums, no vocals, nothing that asks for your attention.',
      tags: ['lofi', 'focus', 'instrumental'],
      chapters: [
        [0, 'Loop one'],
        [92, 'Loop one, still'],
      ],
      transcript: [
        [0, 'The rain is real. The piano is not a piano.'],
        [92, 'No need to watch. Just leave it running.'],
      ],
    },
    {
      id: 'v-crt',
      title: 'Why CRT screens still feel better',
      channel: 'pixel',
      thumb: 'speedrun-crt',
      clip: 'rose',
      views: 724000,
      published: '2026-05-02',
      likes: 34900,
      category: 'Gaming',
      desc:
        'Motion blur, phosphor decay and the fact that old games were drawn for a screen nobody owns anymore. We film a CRT at 960 frames per second to show what your eye actually saw.',
      tags: ['crt', 'retro', 'hardware'],
      chapters: [
        [0, 'Not just nostalgia'],
        [48, 'Phosphor decay'],
      ],
      transcript: [
        [0, 'The blur is the feature. Developers relied on it.'],
        [48, 'At 960 frames per second you can watch the beam draw the image.'],
      ],
    },
    {
      id: 'v-speedrun',
      title: 'Speedrunning a game I have never played',
      channel: 'pixel',
      thumb: 'speedrun-crt-b',
      clip: 'rose',
      views: 1960000,
      published: '2026-09-11',
      likes: 88100,
      category: 'Gaming',
      desc:
        'Twelve hours, one route document and a lot of deaths. The interesting part is not the record, it is how the community discovered the route in the first place.',
      tags: ['speedrun', 'retro'],
      chapters: [
        [0, 'Reading the route'],
        [56, 'The trick that skips a level'],
      ],
      transcript: [
        [0, 'The route doc is longer than the game.'],
        [56, 'One frame of input, and the level never loads.'],
      ],
    },
    {
      id: 'v-launch',
      title: 'A dawn rocket launch, filmed at 1,000 fps',
      channel: 'orbit',
      thumb: 'rocket-launch',
      clip: 'street',
      views: 4280000,
      published: '2026-08-28',
      likes: 198000,
      category: 'Space',
      desc:
        'Our own cameras, twelve kilometers from the pad. Slowed down enough that you can see the shockwave leave the flame trench before the sound arrives.',
      tags: ['launch', 'slow motion', 'rocket'],
      chapters: [
        [0, 'Camera setup'],
        [26, 'Ignition, slowed down'],
      ],
      transcript: [
        [0, 'Three cameras, all armed by hand, none of them rated for this.'],
        [26, 'That white wall is condensation, not smoke. It is moving at the speed of sound.'],
      ],
    },
    {
      id: 'v-pad',
      title: 'Why launches happen at dawn',
      channel: 'orbit',
      thumb: 'rocket-launch-b',
      clip: 'street',
      views: 386000,
      published: '2026-10-03',
      likes: 14200,
      category: 'Space',
      desc:
        'It is not for the photographs. Orbital geometry, range scheduling and one very practical reason involving ice.',
      tags: ['orbital mechanics', 'launch window'],
      chapters: [
        [0, 'The real reason'],
        [30, 'Ice and range scheduling'],
      ],
      transcript: [
        [0, 'The beautiful footage is a side effect, not a plan.'],
        [30, 'Vehicles that have been cold-soaked all night behave differently.'],
      ],
    },
    {
      id: 'v-marathon',
      title: 'My first 100 km: everything I got wrong',
      channel: 'stride',
      thumb: 'marathon',
      clip: 'rose',
      views: 288000,
      published: '2026-04-26',
      likes: 11900,
      category: 'Fitness',
      desc:
        'A full training block, unedited including the two months I was injured. Pacing errors, shoe changes, and the one session that actually mattered.',
      tags: ['ultra running', 'training'],
      chapters: [
        [0, 'The plan'],
        [50, 'Where it fell apart'],
        [84, 'The race'],
      ],
      transcript: [
        [0, 'This spreadsheet is from week three of eighteen.'],
        [50, 'Achilles, right side. I ignored it for eleven days.'],
        [84, 'Mile seventy is where the maths stops working.'],
      ],
    },
    {
      id: 'v-coast',
      title: 'Running the coast road at sunrise',
      channel: 'stride',
      thumb: 'marathon-b',
      clip: 'rose',
      views: 156000,
      published: '2026-09-18',
      likes: 7300,
      category: 'Fitness',
      desc:
        'Twenty-two kilometers along a road that is only quiet before seven. Heart rate, pace and the morning fog, all logged.',
      tags: ['running', 'morning'],
      chapters: [
        [0, 'Five in the morning'],
        [62, 'The last climb'],
      ],
      transcript: [
        [0, 'Zero people on this road. This is the whole reason I run here.'],
        [62, 'Nine hundred meters of climbing, spread across the last four k.'],
      ],
    },
  ];

  const videos = raw.map((v) => {
    const secs = CLIP_LENGTH[v.clip];
    const mm = Math.floor(secs / 60);
    const ss = String(secs % 60).padStart(2, '0');
    return Object.assign({}, v, {
      duration: secs,
      durationLabel: `${mm}:${ss}`,
      src: `assets/video/${v.clip}.mp4`,
      poster: `assets/thumbs/${v.thumb}.jpg`,
      url: `watch.html?v=${v.id}`,
    });
  });

  /**
   * Hand-written comments for the busiest videos; every other video is seeded
   * from the generic pool so the panel is never empty.
   */
  const comments = {
    'v-abyss': [
      { user: 'mira k.', handle: '@mirakelp', text: 'The horizontal migration at 1:58 broke my brain. They commute. In the dark. Every day.', likes: 2841, ago: '3 weeks ago' },
      { user: 'Tomas Riis', handle: '@triis', text: 'Marine biologist here. The tag interpretation at the end is the most careful version I have seen on this platform.', likes: 1204, ago: '2 weeks ago' },
      { user: 'quiet part', handle: '@quietpart', text: 'who else is watching this at 2am with all the lights on', likes: 733, ago: '5 days ago' },
    ],
    'v-compiler': [
      { user: 'Priya Raman', handle: '@priyar', text: 'The second pass starting over instead of patching the tree is such an obvious trick in hindsight. Ten years of textbook reading undone by one whiteboard.', likes: 918, ago: '2 months ago' },
      { user: 'dave', handle: '@davebuilds', text: 'You left the compile error in and then explained it. More of this please.', likes: 402, ago: '6 weeks ago' },
    ],
    'v-synth': [
      { user: 'Ellis', handle: '@elliswav', text: 'The moment it powers on is why I watch this channel. No music cue, just the hum.', likes: 5120, ago: '5 months ago' },
      { user: 'ino', handle: '@ino_audio', text: 'Please do the voice board next, mine has the exact same dead op-amp.', likes: 388, ago: '1 month ago' },
      { user: 'grain', handle: '@grainwindow', text: 'That is a J-wire keyboard and the rust on it is fixable, for anyone who found one in a barn too.', likes: 246, ago: '3 weeks ago' },
    ],
    'v-lofi': [
      { user: 'Sam', handle: '@sam_o', text: 'I have written roughly 40,000 words to this loop. Thank you.', likes: 21400, ago: '1 month ago' },
      { user: 'yuki', handle: '@yukimori', text: 'the rain kicking in at 0:40 is perfect', likes: 8120, ago: '3 weeks ago' },
    ],
    'v-speedrun': [
      { user: 'kestrel', handle: '@kestrel_runs', text: 'Twelve hours in and you found the frame-perfect skip yourself. That is the actual achievement.', likes: 3311, ago: '1 month ago' },
      { user: 'old tech', handle: '@oldtech', text: 'The controllers in the background are worth their own video.', likes: 512, ago: '2 weeks ago' },
    ],
    'v-kyoto': [
      { user: 'hana', handle: '@hanawalks', text: 'No narration, no music, just the street. Subscribed.', likes: 6420, ago: '4 months ago' },
      { user: 'F. Okafor', handle: '@fokafor', text: 'That bell at 0:52 is a temple bell, you can hear the strike and then the ring underneath.', likes: 1902, ago: '2 months ago' },
    ],
    'v-launch': [
      { user: 'noor', handle: '@noor_ph', text: 'The condensation wall leaving the trench before the sound arrives. I have watched this twenty times.', likes: 9820, ago: '1 month ago' },
      { user: 'pad rat', handle: '@padrat', text: 'Twelve klicks with hand-armed cameras is genuinely reckless and I respect it.', likes: 2210, ago: '3 weeks ago' },
    ],
  };

  const genericComments = [
    { user: 'Jordan', handle: '@jordanbuilds', text: 'The pace of this is perfect. No throat-clearing, straight into the middle of it.', likes: 214, ago: '3 weeks ago' },
    { user: 'esme', handle: '@esme_reads', text: 'Watched twice and took notes the second time. The bit about the failure mode is the useful part.', likes: 96, ago: '2 weeks ago' },
    { user: 'k.w.', handle: '@kw_here', text: 'Underrated channel. The production quality does not match the subscriber count.', likes: 61, ago: '6 days ago' },
    { user: 'old mate', handle: '@oldmate', text: 'Audio mix on this is unusually good for a one-person operation.', likes: 38, ago: '4 days ago' },
  ];

  const categories = ['All', 'Programming', 'Music', 'Gaming', 'Travel', 'Science', 'Food', 'Fitness', 'Space'];

  window.OT_DATA = { channels, videos, comments, genericComments, categories };
})();
