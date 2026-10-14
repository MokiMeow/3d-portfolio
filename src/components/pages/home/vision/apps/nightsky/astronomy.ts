import { Vector3, Matrix4 } from 'three';
import type { SkyObject } from './catalog';
export const RAD = Math.PI / 180;
export const cities = [
    { name: 'Bengaluru', lat: 12.97, lon: 77.59, zone: 'Asia/Kolkata' },
    { name: 'London', lat: 51.51, lon: -.13, zone: 'Europe/London' },
    { name: 'New York', lat: 40.71, lon: -74.01, zone: 'America/New_York' },
    { name: 'Tokyo', lat: 35.68, lon: 139.69, zone: 'Asia/Tokyo' },
    { name: 'Sydney', lat: -33.87, lon: 151.21, zone: 'Australia/Sydney' },
    { name: 'Cape Town', lat: -33.92, lon: 18.42, zone: 'Africa/Johannesburg' },
] as const;
export function equatorial(ra: number, dec: number, radius = 100): Vector3 {
    const a = ra * 15 * RAD, d = dec * RAD;
    return new Vector3(Math.cos(d) * Math.cos(a), Math.sin(d), Math.cos(d) * Math.sin(a)).multiplyScalar(radius);
}
/** Equatorial sphere -> observer: +X east, +Y zenith, −Z north. */
export function observerMatrix(time: number, lat: number, lon: number): Matrix4 {
    const jd = time / 86400000 + 2440587.5;
    const lst = (280.46061837 + 360.98564736629 * (jd - 2451545) + lon) * RAD;
    const p = lat * RAD, c = Math.cos(lst), s = Math.sin(lst), sp = Math.sin(p), cp = Math.cos(p);
    return new Matrix4().set(-s, 0, c, 0, cp * c, sp, cp * s, 0, sp * c, -cp, sp * s, 0, 0, 0, 0, 1);
}
type Elements = [
    number,
    number,
    number,
    number,
    number,
    number
];
const sin = (a: number): number => Math.sin(a * RAD);
const cos = (a: number): number => Math.cos(a * RAD);
function orbit([node, tilt, peri, axis, ecc, mean]: Elements): Vector3 {
    const m = ((mean % 360) + 360) % 360 * RAD;
    let e = m;
    for (let i = 0; i < 5; i++)
        e -= (e - ecc * Math.sin(e) - m) / (1 - ecc * Math.cos(e));
    const x = axis * (Math.cos(e) - ecc), y = axis * Math.sqrt(1 - ecc * ecc) * Math.sin(e);
    const v = Math.atan2(y, x) / RAD + peri, r = Math.hypot(x, y);
    return new Vector3(r * (cos(node) * cos(v) - sin(node) * sin(v) * cos(tilt)), r * (sin(node) * cos(v) + cos(node) * sin(v) * cos(tilt)), r * sin(v) * sin(tilt));
}
/** Low precision Keplerian elements, Schlyter's day-zero convention (1999-12-31 UTC).
 * https://www.stjarnhimlen.se/comp/ppcomp.html — no remote ephemeris at runtime.
 * Simplified perturbations, no refraction or lunar parallax: educational, within a few degrees.
 */
export function planets(time: number): SkyObject[] {
    const d = (time - Date.UTC(1999, 11, 31)) / 86400000;
    const solar: Elements = [0, 0, 282.9404 + 4.70935e-5 * d, 1, .016709 - 1.151e-9 * d, 356.047 + .9856002585 * d];
    const sun = orbit(solar);
    const elements: [
        string,
        Elements,
        number,
        number,
        string
    ][] = [
        ['Moon', [125.1228 - .0529538083 * d, 5.1454, 318.0634 + .1643573223 * d, 60.2666, .0549, 115.3654 + 13.0649929509 * d], -12.7, .7, 'Our only natural satellite. A familiar face, with a very long commute.'],
        ['Mercury', [48.3313 + 3.24587e-5 * d, 7.0047 + 5e-8 * d, 29.1241 + 1.01444e-5 * d, .387098, .205635 + 5.59e-10 * d, 168.6562 + 4.0923344368 * d], -.4, .6, 'The smallest planet makes a lap of the Sun in just 88 Earth days.'],
        ['Venus', [76.6799 + 2.4659e-5 * d, 3.3946 + 2.75e-8 * d, 54.891 + 1.38374e-5 * d, .72333, .006773 - 1.302e-9 * d, 48.0052 + 1.6021302244 * d], -4, .8, 'Bright enough to be mistaken for a visitor. It is simply the planet next door.'],
        ['Mars', [49.5574 + 2.11081e-5 * d, 1.8497 - 1.78e-8 * d, 286.5016 + 2.92961e-5 * d, 1.523688, .093405 + 2.516e-9 * d, 18.6021 + .5240207766 * d], .5, 1.5, 'Its rusty colour comes from iron oxides. The solar system has a terracotta phase.'],
        ['Jupiter', [100.4542 + 2.76854e-5 * d, 1.303 - 1.557e-7 * d, 273.8777 + 1.64505e-5 * d, 5.20256, .048498 + 4.469e-9 * d, 19.895 + .0830853001 * d], -2, .8, 'The largest planet turns in about ten hours. A very efficient day.'],
        ['Saturn', [113.6634 + 2.3898e-5 * d, 2.4886 - 1.081e-7 * d, 339.3939 + 2.97661e-5 * d, 9.55475, .055546 - 9.499e-9 * d, 316.967 + .0334442282 * d], .7, 1, 'Those rings are mostly ice. Spectacular accessories, impractical to borrow.'],
    ];
    return elements.map(([name, el, magnitude, bv, fact]) => {
        const p = orbit(el);
        if (name === 'Moon') {
            const elongation = el[5] + el[2] + el[0] - solar[5] - solar[2];
            const longitude = Math.atan2(p.y, p.x) / RAD - 1.274 * sin(el[5] - 2 * elongation) + .658 * sin(2 * elongation) - .186 * sin(solar[5]);
            const latitude = Math.atan2(p.z, Math.hypot(p.x, p.y)) / RAD - .173 * sin(el[5] + el[2] - 2 * elongation);
            const r = p.length();
            p.set(r * cos(latitude) * cos(longitude), r * cos(latitude) * sin(longitude), r * sin(latitude));
        }
        else
            p.add(sun);
        const distance = p.length() * (name === 'Moon' ? 6378.14 : 149597870.7) / 9460730472580.8;
        const obliquity = (23.4393 - 3.563e-7 * d) * RAD;
        const y = p.y * Math.cos(obliquity) - p.z * Math.sin(obliquity), z = p.y * Math.sin(obliquity) + p.z * Math.cos(obliquity);
        return { name, ra: (Math.atan2(y, p.x) / RAD / 15 + 24) % 24, dec: Math.atan2(z, Math.hypot(p.x, y)) / RAD, magnitude, bv, constellation: 'Solar system', distance, fact, planet: true };
    });
}

/** Geocentric solar direction from the same low-precision orbit as the planet atlas. */
export function solarDirection(time: number): Vector3 {
  const d = (time - Date.UTC(1999, 11, 31)) / 86400000;
  const p = orbit([0,0,282.9404+4.70935e-5*d,1,.016709-1.151e-9*d,356.047+.9856002585*d]);
  const e = (23.4393-3.563e-7*d)*RAD;
  return new Vector3(p.x, p.z*Math.cos(e)+p.y*Math.sin(e), p.y*Math.cos(e)-p.z*Math.sin(e)).normalize();
}
export function solarAltitude(time: number, cityIndex: number): number {
  const city = cities[cityIndex] ?? cities[0];
  return Math.asin(solarDirection(time).applyMatrix4(observerMatrix(time,city.lat,city.lon)).y)/RAD;
}
export function moonIllumination(time: number): number {
  const moon = planets(time)[0]!;
  return (1-equatorial(moon.ra,moon.dec,1).dot(solarDirection(time)))/2;
}
