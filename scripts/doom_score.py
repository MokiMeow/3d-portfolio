"""An original score for Doom's reveal, synthesised from scratch (no samples): 21.5 s, stereo, 44.1 kHz.
Times are seconds from the cue's start (the director starts it at X0 + 7.5)."""
import numpy as np, wave, sys

SR = 44100
DUR = 24.5
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)
rng = np.random.default_rng(7)

def env(a, b, c=None, d=None, shape=2.):
    """0 before a, rises to 1 at b, holds, falls from c to 0 at d."""
    e = np.clip((t - a) / max(b - a, 1e-3), 0, 1) ** shape
    if c is not None:
        e = e * np.clip(1 - (t - c) / max(d - c, 1e-3), 0, 1) ** 1.2
    return e

def lowpass(x, cutoff):
    # One-pole low-pass, run twice (gentle 12 dB/oct).
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x); acc = 0.
        for i in range(0, len(x), 4096):
            seg = x[i:i + 4096]
            out = np.empty_like(seg)
            for j, v in enumerate(seg):
                acc = (1 - a) * v + a * acc; out[j] = acc
            y[i:i + 4096] = out
        x = y
    return x

def saw(f, detune=0.):
    ph = (t * f * (1 + detune)) % 1.
    return 2 * ph - 1

# Key moments (cue time)
ENTITY, PAN, REVEAL, TOWER, MOHITH, DOOM, COLLECT, CUT = .5, 2.5, 5.1, 7.7, 13.1, 14.9, 17.7, 21.1

# 1. Sub drone: A1 with a slow beating partner, from the warning onwards; swells toward the end.
drone = (np.sin(2 * np.pi * 55 * t) + .8 * np.sin(2 * np.pi * 55.35 * t) + .5 * np.sin(2 * np.pi * 27.5 * t))
drone *= env(0, 3.5, CUT, CUT + .05) * (.5 + .5 * env(PAN, CUT - .5, shape=1.5)) * .22
L += drone; R += drone

# 2. A dissonant low string cluster (A2, Bb2, E3), detuned saws, low-passed: swells as the camera finds him.
cluster = np.zeros_like(t)
for f, g in [(110, 1.), (116.54, .8), (164.81, .6), (220, .35)]:
    for d in (-.004, 0, .005):
        cluster += g * saw(f, d)
cluster = lowpass(cluster, 700) * env(PAN, REVEAL + 3, CUT, CUT + .05, shape=1.6) * .045
trem = .85 + .15 * np.sin(2 * np.pi * 5.2 * t)
L += cluster * trem; R += cluster * (1.7 - trem)

# 3. Heartbeat drum: a low "lub-dub" pulse that quickens from the tower shot to his face.
def hit(at, f0=48, decay=7., gain=1.):
    m = t >= at; x = np.zeros_like(t); tt = t[m] - at
    x[m] = np.sin(2 * np.pi * f0 * tt * (1 + .6 * np.exp(-tt * 18))) * np.exp(-tt * decay) * gain
    return x
beat = np.zeros_like(t); bt = TOWER
while bt < MOHITH - .3:
    period = 1.5 - .55 * (bt - TOWER) / (MOHITH - TOWER)
    beat += hit(bt, 50, 8, 1.) + hit(bt + .22, 46, 9, .7)
    bt += period
L += beat * .32; R += beat * .32

# 4. A dark choir pad ("ah"): formant-filtered saws on D minor, rising to his face.
choir = np.zeros_like(t)
for f in (146.83, 174.61, 220., 293.66):
    v = saw(f, .003) + saw(f, -.003)
    # formants of "ah": approximate with resonant emphasis via two low-passes at different cutoffs
    choir += lowpass(v, 900) - .6 * lowpass(v, 350)
choir *= env(TOWER + 1, MOHITH - .5, CUT, CUT + .05, shape=1.8) * .05
vib = np.sin(2 * np.pi * .3 * t)
L += choir * (1 + .1 * vib); R += choir * (1 - .1 * vib)

# The arc: everything so far starts low and climbs to its peak at "I am Doom" (the hit and brass ride on top).
arc = .22 + .78 * env(PAN, DOOM, shape=2.2)
L *= arc; R *= arc

# 5. "I am Doom": a huge low hit and a sustained brass-like chord (A1 D2 A2 F3), cut at the fade.
boom = hit(DOOM - .05, 38, 2.2, 1.6) + lowpass(rng.standard_normal(len(t)) * np.exp(-np.clip(t - DOOM + .05, 0, None) * 6) * (t >= DOOM - .05), 400) * .6
brass = np.zeros_like(t)
for f, g in [(55, 1.), (73.42, .8), (110, .7), (174.61, .5)]:
    brass += g * (saw(f, .002) + saw(f, -.002))
brass = lowpass(brass, 520) * env(DOOM, DOOM + 1.6, CUT, CUT + .05, shape=1.3) * .07
L += boom * .5 + brass; R += boom * .5 + brass

# Duck under each spoken line (so the voice sits on top), then a long reverb-ish tail after the cut.
duck = np.ones_like(t)
for at, length in [(MOHITH, 1.4), (DOOM, 2.4), (COLLECT, 2.7)]:
    d = np.clip((t - (at - .15)) / .15, 0, 1) * np.clip(1 - (t - (at + length)) / .5, 0, 1)
    duck *= 1 - .45 * d
L *= duck; R *= duck

def tail(x):
    out = x.copy()
    for delay, g in [(.031, .35), (.057, .3), (.089, .25), (.137, .2), (.211, .15), (.33, .1)]:
        n = int(delay * SR); out[n:] += x[:-n] * g
    return out
L, R = tail(L), tail(R[::1])

mix = np.stack([L, R], 1)
mix /= np.max(np.abs(mix)) * 1.12
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("ok", DUR)
