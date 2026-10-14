/** Rounded J2000 RA (hours), declination (degrees), visual magnitude, B−V and distance (ly).
 * A hand-authored bright-star atlas, not a precision astrometry catalogue. Variables use typical magnitudes.
 * Coordinate convention follows the IAU charts: https://iauarchive.eso.org/public/themes/constellations/
 * Distances are approximate; multiple systems are represented by their combined naked-eye point.
 */
export interface SkyObject {
    name: string;
    ra: number;
    dec: number;
    magnitude: number;
    bv: number;
    constellation: string;
    distance: number;
    fact?: string;
    planet?: boolean;
}
const rows = `Sirius|6.7525|-16.7161|-1.46|0.00|Canis Major|8.6
Canopus|6.3992|-52.6957|-0.74|0.15|Carina|310
Arcturus|14.2610|19.1824|-0.05|1.23|Boötes|36.7
Alpha Centauri|14.6601|-60.8339|-0.27|0.71|Centaurus|4.37
Vega|18.6156|38.7837|0.03|0.00|Lyra|25
Capella|5.2782|45.9980|0.08|0.80|Auriga|42.9
Rigel|5.2423|-8.2016|0.13|-0.03|Orion|860
Procyon|7.6550|5.2250|0.34|0.42|Canis Minor|11.5
Betelgeuse|5.9195|7.4071|0.50|1.85|Orion|550
Achernar|1.6286|-57.2368|0.46|-0.16|Eridanus|139
Hadar|14.0637|-60.3730|0.61|-0.23|Centaurus|390
Altair|19.8464|8.8683|0.76|0.22|Aquila|16.7
Acrux|12.4433|-63.0991|0.76|-0.24|Crux|320
Aldebaran|4.5987|16.5093|0.86|1.54|Taurus|65
Antares|16.4901|-26.4320|0.96|1.83|Scorpius|550
Spica|13.4199|-11.1613|0.98|-0.23|Virgo|250
Pollux|7.7553|28.0262|1.14|1.00|Gemini|33.8
Fomalhaut|22.9608|-29.6222|1.16|0.09|Piscis Austrinus|25.1
Deneb|20.6905|45.2803|1.25|0.09|Cygnus|2600
Mimosa|12.7953|-59.6888|1.25|-0.23|Crux|280
Regulus|10.1395|11.9672|1.35|-0.11|Leo|79
Adhara|6.9771|-28.9721|1.50|-0.21|Canis Major|430
Castor|7.5767|31.8883|1.58|0.04|Gemini|51
Shaula|17.5601|-37.1038|1.62|-0.23|Scorpius|570
Gacrux|12.5194|-57.1132|1.63|1.60|Crux|89
Bellatrix|5.4189|6.3497|1.64|-0.22|Orion|250
Elnath|5.4382|28.6075|1.65|-0.13|Taurus|134
Miaplacidus|9.2200|-69.7172|1.67|0.00|Carina|113
Alnilam|5.6036|-1.2019|1.69|-0.19|Orion|2000
Alnair|22.1372|-46.9610|1.74|-0.03|Grus|101
Alnitak|5.6793|-1.9426|1.77|-0.20|Orion|1260
Alioth|12.9005|55.9598|1.77|0.02|Ursa Major|83
Dubhe|11.0621|61.7508|1.79|1.07|Ursa Major|123
Mirfak|3.4054|49.8612|1.79|0.48|Perseus|510
Wezen|7.1399|-26.3932|1.83|0.68|Canis Major|1600
Sargas|17.6220|-42.9978|1.86|0.40|Scorpius|270
Kaus Australis|18.4029|-34.3846|1.85|-0.03|Sagittarius|143
Avior|8.3752|-59.5095|1.86|1.20|Carina|610
Alkaid|13.7923|49.3133|1.86|-0.19|Ursa Major|104
Menkalinan|5.9921|44.9474|1.90|0.08|Auriga|81
Atria|16.8111|-69.0277|1.91|1.44|Triangulum Australe|391
Alhena|6.6285|16.3993|1.93|0.00|Gemini|109
Peacock|20.4275|-56.7351|1.94|-0.20|Pavo|179
Alsephina|8.7451|-54.7088|1.96|0.04|Vela|80
Mirzam|6.3783|-17.9559|1.98|-0.24|Canis Major|490
Alphard|9.4598|-8.6586|1.98|1.44|Hydra|177
Polaris|2.5303|89.2641|1.98|0.60|Ursa Minor|447
Hamal|2.1196|23.4624|2.00|1.15|Aries|65.8
Algieba|10.3329|19.8415|2.01|1.13|Leo|130
Diphda|0.7265|-17.9866|2.02|1.02|Cetus|96
Nunki|18.9211|-26.2967|2.05|-0.13|Sagittarius|228
Menkent|14.1114|-36.3700|2.06|1.01|Centaurus|61
Mirach|1.1622|35.6206|2.05|1.58|Andromeda|197
Alpheratz|0.1398|29.0904|2.06|-0.04|Andromeda|97
Rasalhague|17.5822|12.5600|2.08|0.15|Ophiuchus|49
Kochab|14.8451|74.1555|2.08|1.47|Ursa Minor|131
Saiph|5.7959|-9.6696|2.07|-0.17|Orion|650
Denebola|11.8177|14.5721|2.14|0.09|Leo|36
Algol|3.1361|40.9556|2.12|-0.05|Perseus|93
Tiaki|22.7111|-46.8846|2.07|1.61|Grus|177
Muhlifain|12.6919|-48.9599|2.17|-0.01|Centaurus|130
Aspidiske|9.2848|-59.2752|2.21|0.18|Carina|690
Suhail|9.1333|-43.4326|2.21|1.67|Vela|545
Alphecca|15.5781|26.7147|2.23|0.03|Corona Borealis|75
Mintaka|5.5334|-0.2991|2.23|-0.22|Orion|1200
Sadr|20.3705|40.2567|2.23|0.67|Cygnus|1800
Eltanin|17.9434|51.4889|2.23|1.52|Draco|154
Schedar|0.6751|56.5373|2.24|1.17|Cassiopeia|228
Naos|8.0597|-40.0031|2.25|-0.27|Puppis|1080
Almach|2.0649|42.3297|2.10|1.37|Andromeda|350
Caph|0.1529|59.1498|2.27|0.34|Cassiopeia|55
Izar|14.7498|27.0742|2.37|1.04|Boötes|203
Dschubba|16.0056|-22.6217|2.32|-0.12|Scorpius|490
Larawag|16.8361|-34.2932|2.29|1.14|Scorpius|64
Merak|11.0307|56.3824|2.37|0.03|Ursa Major|80
Ankaa|0.4381|-42.3061|2.39|1.08|Phoenix|85
Girtab|17.7081|-39.0299|2.41|-0.22|Scorpius|480
Enif|21.7364|9.8750|2.39|1.52|Pegasus|690
Scheat|23.0629|28.0828|2.42|1.67|Pegasus|196
Sabik|17.1729|-15.7249|2.43|0.06|Ophiuchus|88
Phecda|11.8972|53.6948|2.44|0.04|Ursa Major|83
Aludra|7.4016|-29.3031|2.45|-0.08|Canis Major|2000
Markeb|9.3686|-55.0107|2.50|-0.18|Vela|570
Navi|0.9451|60.7167|2.15|-0.15|Cassiopeia|550
Markab|23.0794|15.2053|2.49|0.00|Pegasus|133
Aljanah|20.7702|33.9703|2.48|1.03|Cygnus|73
Gienah|12.2634|-17.5419|2.59|-0.11|Corvus|154
Zosma|11.2351|20.5237|2.56|0.12|Leo|58
Zubeneschamali|15.2834|-9.3829|2.61|-0.11|Libra|185
Arneb|5.5455|-17.8223|2.58|0.21|Lepus|2200
Delta Centauri|12.1393|-50.7224|2.58|-0.12|Centaurus|410
Ruchbah|1.4303|60.2353|2.68|0.13|Cassiopeia|99
Muphrid|13.9114|18.3977|2.68|0.58|Boötes|37
Hassaleh|4.9499|33.1661|2.69|1.49|Auriga|490
Lesath|17.5127|-37.2958|2.70|-0.20|Scorpius|580
Kaus Media|18.3499|-29.8281|2.70|1.38|Sagittarius|348
Tarazed|19.7709|10.6133|2.72|1.52|Aquila|395
Alshain|19.9219|6.4068|3.71|0.86|Aquila|45
Yed Prior|16.2391|-3.6943|2.74|1.58|Ophiuchus|171
Porrima|12.6943|-1.4494|2.74|0.37|Virgo|38
Imai|12.2524|-58.7489|2.79|-0.23|Crux|345
Cebalrai|17.7245|4.5673|2.76|1.17|Ophiuchus|82
Rastaban|17.5072|52.3014|2.79|0.98|Draco|380
Kornephoros|16.5037|21.4896|2.77|0.94|Hercules|139
Rasalgethi|17.2441|14.3903|3.06|1.44|Hercules|360
Zubenelgenubi|14.8479|-16.0418|2.75|0.15|Libra|77
Cursa|5.1308|-5.0864|2.79|0.16|Eridanus|89
Algenib|0.2206|15.1836|2.83|-0.19|Pegasus|390
Rutilicus|16.6881|31.6019|2.81|0.65|Hercules|35
Ras Elased Australis|9.7642|23.7743|2.98|0.81|Leo|247
Cor Caroli|12.9338|38.3184|2.89|-0.12|Canes Venatici|115
Alcyone|3.7914|24.1051|2.87|-0.09|Taurus|440
Albireo|19.5120|27.9597|3.05|1.09|Cygnus|430
Matar|22.7167|30.2212|2.95|0.86|Pegasus|214
Sadalsuud|21.5260|-5.5712|2.87|0.83|Aquarius|540
Sadalmelik|22.0964|-0.3198|2.94|0.98|Aquarius|520
Acamar|2.9710|-40.3047|2.91|0.14|Eridanus|161
Alnasl|18.0968|-30.4241|2.98|0.98|Sagittarius|96
Kaus Borealis|18.4662|-25.4217|2.82|1.03|Sagittarius|78
Algedi|20.3009|-12.5449|3.57|0.93|Capricornus|106
Deneb Algedi|21.7840|-16.1273|2.85|0.18|Capricornus|39
Dabih|20.3502|-14.7814|3.05|0.79|Capricornus|328
Pherkad|15.3455|71.8340|3.00|0.06|Ursa Minor|487
Megrez|12.2571|57.0326|3.31|0.08|Ursa Major|81
Yildun|17.5369|86.5865|4.36|0.02|Ursa Minor|172
Epsilon Ursae Minoris|16.7662|82.0373|4.21|0.89|Ursa Minor|347
Zeta Ursae Minoris|15.7343|77.7945|4.32|0.05|Ursa Minor|380
Eta Ursae Minoris|16.2918|75.7553|4.95|0.39|Ursa Minor|97
Sheliak|18.8347|33.3627|3.52|0.00|Lyra|960
Sulafat|18.9824|32.6896|3.25|-0.05|Lyra|620
Delta Lyrae|18.9084|36.8986|4.30|1.67|Lyra|900
Epsilon Lyrae|18.7397|39.6701|4.67|0.17|Lyra|162
Mebsuta|6.7322|25.1311|2.98|1.40|Gemini|840
Wasat|7.3354|21.9823|3.53|0.34|Gemini|60
Propus|6.2479|22.5068|3.28|1.60|Gemini|380
Zeta Tauri|5.6274|21.1425|3.00|-0.15|Taurus|440
Ain|4.4769|19.1804|3.53|1.01|Taurus|147
Meissa|5.5856|9.9342|3.39|-0.18|Orion|1100
Delta Andromedae|0.6555|30.8609|3.27|1.27|Andromeda|105
Altais|19.2092|67.6615|3.07|0.99|Draco|97`;
export const stars: SkyObject[] = rows.split('\n').map(row => {
    const [name, ra, dec, magnitude, bv, constellation, distance] = row.split('|');
    return { name: name!, ra: Number(ra), dec: Number(dec), magnitude: Number(magnitude), bv: Number(bv), constellation: constellation!, distance: Number(distance) };
});
// Additional bright southern and equatorial stars complete the all-sky naked-eye sample.
stars.push({ name: 'Alpha Lupi', ra: 14.6988, dec: -47.3882, magnitude: 2.30, bv: -.15, constellation: 'Lupus', distance: 460 }, { name: 'Beta Lupi', ra: 14.9755, dec: -43.1339, magnitude: 2.68, bv: -.22, constellation: 'Lupus', distance: 383 }, { name: 'Alpha Muscae', ra: 12.6197, dec: -69.1356, magnitude: 2.69, bv: -.18, constellation: 'Musca', distance: 315 }, { name: 'Iota Centauri', ra: 13.3433, dec: -36.7123, magnitude: 2.75, bv: .07, constellation: 'Centaurus', distance: 59 }, { name: 'Athebyne', ra: 16.3999, dec: 61.5142, magnitude: 2.74, bv: .91, constellation: 'Draco', distance: 92 }, { name: 'Beta Hydri', ra: .4292, dec: -77.2542, magnitude: 2.80, bv: .62, constellation: 'Hydrus', distance: 24 }, { name: 'Paikauhale', ra: 16.5980, dec: -28.2160, magnitude: 2.82, bv: -.25, constellation: 'Scorpius', distance: 470 }, { name: 'Beta Trianguli Australis', ra: 15.9190, dec: -63.4307, magnitude: 2.85, bv: .29, constellation: 'Triangulum Australe', distance: 40 }, { name: 'Gamma Trianguli Australis', ra: 15.3152, dec: -68.6795, magnitude: 2.89, bv: .00, constellation: 'Triangulum Australe', distance: 184 }, { name: 'Alpha Tucanae', ra: 22.3096, dec: -60.2596, magnitude: 2.86, bv: 1.39, constellation: 'Tucana', distance: 200 }, { name: 'Alniyat', ra: 16.3531, dec: -25.5928, magnitude: 2.89, bv: .13, constellation: 'Scorpius', distance: 568 }, { name: 'Phi Sagittarii', ra: 18.7609, dec: -26.9908, magnitude: 3.17, bv: -.11, constellation: 'Sagittarius', distance: 239 }, { name: 'Regor', ra: 8.1589, dec: -47.3366, magnitude: 1.75, bv: -.04, constellation: 'Vela', distance: 1100 }, { name: 'Epsilon Centauri', ra: 13.6648, dec: -53.4664, magnitude: 2.30, bv: -.22, constellation: 'Centaurus', distance: 430 }, { name: 'Eta Centauri', ra: 14.5918, dec: -42.1578, magnitude: 2.31, bv: -.21, constellation: 'Centaurus', distance: 306 }, { name: 'Zeta Centauri', ra: 13.9257, dec: -47.2883, magnitude: 2.55, bv: -.22, constellation: 'Centaurus', distance: 382 }, { name: 'Zeta Ophiuchi', ra: 16.6193, dec: -10.5671, magnitude: 2.56, bv: .02, constellation: 'Ophiuchus', distance: 366 }, { name: 'Zeta Arae', ra: 16.9770, dec: -55.9901, magnitude: 3.12, bv: 1.60, constellation: 'Ara', distance: 490 }, { name: 'Beta Arae', ra: 17.4217, dec: -55.5299, magnitude: 2.84, bv: 1.46, constellation: 'Ara', distance: 650 }, { name: 'Alpha Arae', ra: 17.5307, dec: -49.8761, magnitude: 2.95, bv: -.17, constellation: 'Ara', distance: 270 }, { name: 'Zeta Persei', ra: 3.9022, dec: 31.8836, magnitude: 2.85, bv: .12, constellation: 'Perseus', distance: 750 }, { name: 'Atik', ra: 3.7386, dec: 32.2882, magnitude: 3.83, bv: .02, constellation: 'Perseus', distance: 1000 }, { name: 'Gomeisa', ra: 7.4525, dec: 8.2893, magnitude: 2.89, bv: -.09, constellation: 'Canis Minor', distance: 162 }, { name: 'Pi Scorpii', ra: 15.9809, dec: -26.1141, magnitude: 2.89, bv: -.19, constellation: 'Scorpius', distance: 590 });
const facts: Record<string, string> = {
    Sirius: 'The brightest star in our night sky has a tiny white-dwarf companion. Even stars bring a plus-one.',
    Vega: 'Its light has been travelling for about 25 years. A very patient delivery service.',
    Betelgeuse: 'A red supergiant with a changing brightness. Orion has a rather dramatic shoulder.',
    Polaris: 'Close to the north celestial pole, it barely moves as the rest of the sky turns.',
    Capella: 'That single golden point is a multiple-star system. Celestial teamwork.',
    Albireo: 'A telescope resolves a beautiful gold-and-blue pair. The sky has excellent colour taste.',
    Algol: 'An eclipsing binary: its companion regularly steps in front and dims the light.',
    'Alpha Centauri': 'Our nearest neighbouring stellar system. Still more than four light-years away.',
    Deneb: 'A distant supergiant and the tail of the swan. Small on screen, enormous in person.',
};
for (const star of stars)
    star.fact = facts[star.name];
export const constellations: {
    name: string;
    ra: number;
    dec: number;
    paths: string[][];
}[] = [
    { name: 'Orion', ra: 5.6, dec: 3, paths: [['Betelgeuse', 'Bellatrix', 'Mintaka', 'Rigel', 'Saiph', 'Alnitak', 'Betelgeuse'], ['Mintaka', 'Alnilam', 'Alnitak'], ['Bellatrix', 'Meissa', 'Betelgeuse']] },
    { name: 'Ursa Major', ra: 12.3, dec: 49, paths: [['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Dubhe'], ['Megrez', 'Alioth', 'Alkaid']] },
    { name: 'Ursa Minor', ra: 15.5, dec: 82, paths: [['Polaris', 'Yildun', 'Epsilon Ursae Minoris', 'Zeta Ursae Minoris', 'Kochab', 'Pherkad', 'Eta Ursae Minoris', 'Zeta Ursae Minoris']] },
    { name: 'Cassiopeia', ra: 1, dec: 64, paths: [['Caph', 'Schedar', 'Navi', 'Ruchbah', 'Segin']] },
    { name: 'Cygnus', ra: 20.2, dec: 46, paths: [['Deneb', 'Sadr', 'Albireo'], ['Aljanah', 'Sadr', 'Fawaris']] },
    { name: 'Lyra', ra: 18.8, dec: 42, paths: [['Vega', 'Epsilon Lyrae', 'Delta Lyrae', 'Sulafat', 'Sheliak', 'Vega'], ['Sheliak', 'Delta Lyrae']] },
    { name: 'Scorpius', ra: 16.8, dec: -29, paths: [['Dschubba', 'Antares', 'Larawag', 'Sargas', 'Girtab', 'Shaula', 'Lesath']] },
    { name: 'Leo', ra: 10.8, dec: 24, paths: [['Regulus', 'Algieba', 'Ras Elased Australis', 'Rasalas'], ['Algieba', 'Zosma', 'Denebola', 'Regulus']] },
    { name: 'Gemini', ra: 7.2, dec: 34, paths: [['Castor', 'Mebsuta', 'Propus'], ['Castor', 'Pollux', 'Wasat', 'Alhena'], ['Mebsuta', 'Wasat']] },
    { name: 'Taurus', ra: 4.7, dec: 25, paths: [['Elnath', 'Ain', 'Aldebaran', 'Zeta Tauri'], ['Ain', 'Alcyone']] },
    { name: 'Canis Major', ra: 6.9, dec: -22, paths: [['Mirzam', 'Sirius', 'Wezen', 'Adhara', 'Sirius'], ['Wezen', 'Aludra']] },
    { name: 'Crux', ra: 12.5, dec: -63, paths: [['Acrux', 'Gacrux'], ['Mimosa', 'Imai']] },
    { name: 'Centaurus', ra: 13.8, dec: -48, paths: [['Alpha Centauri', 'Hadar', 'Muhlifain', 'Menkent'], ['Muhlifain', 'Delta Centauri']] },
    { name: 'Sagittarius', ra: 18.6, dec: -32, paths: [['Alnasl', 'Kaus Media', 'Kaus Borealis', 'Nunki', 'Ascella', 'Kaus Australis', 'Alnasl'], ['Kaus Australis', 'Kaus Media', 'Nunki']] },
    { name: 'Andromeda', ra: 1.3, dec: 43, paths: [['Alpheratz', 'Delta Andromedae', 'Mirach', 'Almach']] },
];
// A few fainter line anchors, kept in the same single Points batch.
stars.push({ name: 'Mizar', ra: 13.3987, dec: 54.9254, magnitude: 2.23, bv: .02, constellation: 'Ursa Major', distance: 83 }, { name: 'Segin', ra: 1.9066, dec: 63.6701, magnitude: 3.35, bv: -.15, constellation: 'Cassiopeia', distance: 410 }, { name: 'Fawaris', ra: 19.7496, dec: 45.1308, magnitude: 2.87, bv: -.02, constellation: 'Cygnus', distance: 165 }, { name: 'Rasalas', ra: 9.8794, dec: 26.0069, magnitude: 3.88, bv: 1.22, constellation: 'Leo', distance: 124 }, { name: 'Ascella', ra: 19.0435, dec: -29.8801, magnitude: 2.60, bv: .08, constellation: 'Sagittarius', distance: 89 });
const dipper = constellations.find(item => item.name === 'Ursa Major');
if (dipper)
    dipper.paths[1] = ['Megrez', 'Alioth', 'Mizar', 'Alkaid'];
