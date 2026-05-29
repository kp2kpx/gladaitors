# GLADAITORS Audio Files

Drop your audio files here. The system will silently fall back to Web Audio API
synthetic tones if a file is missing or fails to load, so the app always works.

## Required files

### Background Music
| Filename | Description | Target |
|----------|-------------|--------|
| `music.mp3` | Calm ambient loop — ancient colosseum at dusk | Loop at 0.3 volume |

### Sound Effects
| Filename | Description | Target |
|----------|-------------|--------|
| `hit.mp3` | Normal sword clash / impact | Plays on every normal hit |
| `crit.mp3` | Power charge-up / dramatic energy build | Plays on crit charge-up (before projectile fires) |
| `death.mp3` | Dramatic defeat sound — horn, crash, crowd | Plays when a fighter falls |
| `victory.mp3` | Victory fanfare — triumphant, short | Plays when YOU win |
| `round_start.mp3` | Subtle round-start signal (optional) | Plays at each round announce |

---

## Recommended royalty-free sources

### Background Music — "peaceful ancient colosseum at dusk"

1. **Pixabay — "Ancient Greece" by Coma-Media**
   https://pixabay.com/music/meditationspiritual-ancient-greece-162313/
   CC0 — calm lyre/ambient loop, fits perfectly. Download MP3.

2. **Pixabay — "Meditation Ambient" by Lexin_Music**
   https://pixabay.com/music/meditationspiritual-meditation-ambient-112280/
   CC0 — atmospheric, low energy. Good fallback.

3. **Freesound — "Ancient Greek Music Loop" by Tuben**
   https://freesound.org/people/Tuben/sounds/241000/
   CC0 — ancient flute loop.

Rename whichever you choose to `music.mp3`.

### Hit SFX
- **Mixkit — "Sword Clash"**: https://mixkit.co/free-sound-effects/sword/
  Free license — search "sword clash" or "metal hit". Rename to `hit.mp3`.

- **Pixabay — "Sword Impact"**: https://pixabay.com/sound-effects/search/sword/
  CC0 — pick any short sword impact. Rename to `hit.mp3`.

### Critical Hit SFX
- **Mixkit — "Power Up"**: https://mixkit.co/free-sound-effects/game/
  Search "power up" or "energy charge". Short rising tone, rename to `crit.mp3`.

- **Freesound — "Charge Up" by Bertrof**: https://freesound.org/search/?q=charge+up
  CC0 — energy charge effect.

### Death SFX
- **Mixkit — "Dramatic Fail Horn"**: https://mixkit.co/free-sound-effects/fail/
  Search "dramatic" or "lose". Rename to `death.mp3`.

- **Pixabay — "Game Over"**: https://pixabay.com/sound-effects/search/game-over/
  CC0.

### Victory SFX
- **Mixkit — "Win Fanfare"**: https://mixkit.co/free-sound-effects/win/
  Short victorious jingle. Rename to `victory.mp3`.

- **Pixabay — "Victory"**: https://pixabay.com/sound-effects/search/victory/
  CC0.

### Round Start SFX (optional)
- **Mixkit — "Bell"**: https://mixkit.co/free-sound-effects/bell/
  Short bell ding. Rename to `round_start.mp3`.

---

## Volume levels (set in useAudio.ts)
- Background music: 0.3 (subtle, never distracting)
- SFX: 0.7 (punchy but not jarring)

## Format notes
- MP3 preferred for broadest browser support
- Aim for: music < 5MB, SFX < 200KB each
- Mono SFX is fine; music can be stereo
