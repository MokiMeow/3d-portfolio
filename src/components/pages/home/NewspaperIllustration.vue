<script setup lang="ts">
defineProps<{ kind: 'city' | 'tech' | 'sport' | 'comic' }>();
</script>

<template>
  <!-- Original ink illustrations: sharp at any zoom, no grain filter or large image downloads. -->
  <svg v-if="kind === 'city'" viewBox="0 0 760 300" role="img" aria-label="An auto waits at a signal beside a chai stall. Its driver has time for another cup." class="editorial-ink">
    <g class="fine" opacity=".45">
      <path d="M0 150H760M35 150V49H133V150M145 150V23H228V150M243 150V75H312V150M495 150V60H565V150M581 150V32H687V150M706 150V80H760" />
      <path v-for="n in 5" :key="n" :d="`M48 ${55 + n * 15}H119 M155 ${30 + n * 18}H217 M591 ${40 + n * 19}H674`" />
    </g>
    <path class="fine" d="M8 267H750M13 276H220M291 276H520M630 276H750M374 294H563" />
    <g class="line">
      <path class="paper" d="M265 239V162Q267 109 298 98H416L452 173V239Z" />
      <path class="ink" d="M267 158Q269 115 298 98H416L426 121H295L280 158Z" />
      <path d="M310 127H369V181H285ZM381 127H413L437 177H381Z" />
      <path class="ink" d="M266 195H452V239H265ZM280 181H361V188H280Z" />
      <path class="paper" d="M363 169H382V240H363Z" /><path d="M404 188H431M405 194H433M410 201H436" />
      <circle class="ink" cx="296" cy="244" r="24" /><circle class="paper" cx="296" cy="244" r="11" /><circle class="ink" cx="425" cy="244" r="24" /><circle class="paper" cx="425" cy="244" r="11" />
      <path d="M314 177V155Q314 144 325 144Q337 144 337 156V167L351 173M329 176 346 157" />
      <circle class="paper" cx="326" cy="137" r="10" /><path d="M316 133Q326 121 336 133M342 154H357V168H342ZM358 157Q367 157 358 165" />
      <path d="M223 267V127M204 91H242V148H204Z" class="paper" /><circle class="ink" cx="223" cy="105" r="8" /><circle cx="223" cy="131" r="8" />
      <path class="paper" d="M497 155H708V173H497ZM514 173V267M692 173V267M521 250H687M523 118V151H680V118" />
      <path class="ink" d="M510 104H695L716 126H491Z" /><path d="M539 155V137M548 155V137M557 155V137M623 133V152H657V133ZM657 138Q674 137 660 149" />
      <path d="M610 150Q607 121 634 117L642 132M633 117V110M627 108H641" />
      <path class="fine" d="M631 100Q622 92 632 85Q641 79 631 71M645 99Q636 91 646 82" />
      <path class="ink" d="M535 211H672V250H535Z" />
      <path class="paper" d="M307 10H473Q490 10 490 26V65Q490 80 473 80H376L353 102V80H307Q290 80 290 65V26Q290 10 307 10Z" />
    </g>
    <g class="caption"><text x="390" y="38" text-anchor="middle">JUST FIVE MINUTES.</text><text x="390" y="60" text-anchor="middle" class="small">SAME AS THE LAST FIVE.</text><text x="605" y="195" text-anchor="middle">CHAI</text><text x="605" y="228" text-anchor="middle" class="small paper-text">NO Wi-Fi.</text><text x="605" y="244" text-anchor="middle" class="small paper-text">TALK TO PEOPLE.</text><text x="357" y="224" text-anchor="end" class="small paper-text">ON THE WAY</text></g>
  </svg>

  <svg v-else-if="kind === 'tech'" viewBox="0 0 760 300" role="img" aria-label="A robot and a very untidy computer desktop, with folders named final, final two, and actually final." class="editorial-ink">
    <defs><pattern id="tech-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 6 0" stroke="currentColor" stroke-width=".6" /></pattern></defs>
    <g class="line">
      <path d="M58 251H710M98 252V291M665 252V291" /><path fill="url(#tech-hatch)" d="M81 254H689V264H81Z" />
      <path class="ink" d="M92 51H388V217H92Z" /><path class="paper" d="M103 62H377V195H103Z" /><path d="M226 217V237H198V246H290V237H257V217" />
      <path class="fine" d="M104 82H375M115 73H119M124 73H128M133 73H137" />
      <g v-for="(folder, n) in ['final', 'final_2', 'FINAL', 'actual_final', 'new', 'new_new']" :key="folder">
        <path :transform="`translate(${118 + (n % 3) * 85},${94 + Math.floor(n / 3) * 48})`" class="paper" d="M0 7V0H20L25 7H57V27H0Z" />
        <text :x="147 + (n % 3) * 85" :y="133 + Math.floor(n / 3) * 48" class="tiny caption" text-anchor="middle">{{ folder }}</text>
      </g>
      <path class="paper" d="M149 237H178L184 249H138Z" /><path d="M353 232H386L403 244H336ZM352 238H385" />
      <path class="paper" d="M493 163H594L604 228H483Z" /><path fill="url(#tech-hatch)" d="M506 198H583V216H506Z" /><path class="paper" d="M481 84H608V161H481Z" />
      <path d="M490 93H599V143H490Z" /><circle class="ink" cx="518" cy="119" r="8" /><circle class="ink" cx="571" cy="119" r="8" /><path d="M531 137Q544 147 558 136M544 84V71" /><circle cx="544" cy="65" r="6" />
      <path d="M485 176 452 198 423 185M594 176 624 189 640 155M501 231V249M584 231V249" /><circle cx="456" cy="197" r="6" /><circle cx="624" cy="189" r="6" /><path d="M637 157 634 144M640 157 645 142M642 158 651 150" />
      <path class="ink" d="M493 247H518V253H493ZM570 247H595V253H570Z" />
      <path class="paper" d="M420 10H696V61H610L595 82V61H420Z" />
      <path class="paper" d="M653 220H688L683 249H659Z" /><path d="M671 221V181M671 205Q646 206 651 186Q671 187 671 205M672 194Q697 193 690 173Q671 176 672 194" />
    </g>
    <g class="caption"><text x="558" y="33" text-anchor="middle">I HAVE ORGANISED EVERYTHING.</text><text x="558" y="51" text-anchor="middle" class="small">PLEASE DO NOT OPEN THE FOLDERS.</text><text x="544" y="185" text-anchor="middle" class="small">R&amp;D UNIT 01</text></g>
  </svg>

  <svg v-else-if="kind === 'sport'" viewBox="0 0 760 300" role="img" aria-label="A gully cricket batter looks up to a neighbour on the balcony, waiting for her decision." class="editorial-ink">
    <defs><pattern id="sport-hatch" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 7 0" stroke="currentColor" stroke-width=".6" /></pattern></defs>
    <g class="line">
      <path class="fine" d="M0 270H760M26 288H230M430 288H661M457 272V10H722V272M457 185H721" />
      <path class="paper" d="M501 34H665V140H501Z" /><path fill="url(#sport-hatch)" d="M512 44H655V137H512Z" />
      <path class="paper" d="M528 93Q545 75 561 93L575 137H517Z" /><circle class="paper" cx="544" cy="71" r="17" /><path class="ink" d="M527 69Q526 41 549 51Q565 53 560 70L550 60Z" /><path d="M539 74H541M550 74H552M540 82H551M554 98 583 81 590 63" />
      <path class="paper" d="M478 112H689V122H478ZM480 147H688V155H480Z" /><path v-for="n in 13" :key="n" :d="`M${479+n*15} 122V147`" />
      <path class="paper" d="M620 111H645L642 98H624Z" /><path d="M632 99V72M632 88 623 79M632 81 640 70" />
      <path class="paper" d="M554 205H650V270H554Z" /><path d="M602 206V270M608 235V245" />
      <path class="paper" d="M213 159Q236 147 254 165L248 212H214Z" /><path fill="url(#sport-hatch)" d="M215 206H248L253 236H233L230 220 224 237H207Z" /><path d="M213 236 204 267M244 236 250 267M204 267H183M250 267H269" />
      <circle class="paper" cx="238" cy="134" r="17" /><path class="ink" d="M218 128Q230 107 254 124L260 130H218Z" /><path d="M249 138H253M248 145 255 143M252 171 277 183 283 162M214 171 194 190 180 172" />
      <path class="paper" d="M163 213 178 165 191 169 176 217Z" /><path d="M183 168 191 145M282 161 277 151M283 159 286 150" />
      <path d="M136 215V270M145 215V270M154 215V270M132 211H157" />
      <circle class="ink" cx="409" cy="186" r="5" /><path class="fine" stroke-dasharray="5 6" d="M281 192Q323 82 410 186" />
      <path class="paper" d="M50 25H337V87H258L249 110 237 87H50Z" />
    </g>
    <g class="caption"><text x="194" y="51" text-anchor="middle">AUNTY, WAS THAT OUT?</text><text x="194" y="74" text-anchor="middle" class="small">FIRST TELL ME WHO BROKE THE POT.</text><text x="583" y="176" text-anchor="middle" class="small">OFFICIAL REVIEW BOX</text></g>
  </svg>

  <div v-else class="comic-strip" role="group" aria-label="Overengineered, a three-panel comic">
    <svg v-for="(lines, n) in [['I NEED WATER.'], ['I BUILT YOU AN APP.', 'AND A DASHBOARD.'], ['OR, A GLASS', 'OF WATER?']]"
      :key="n" viewBox="0 0 246 270" role="img" :aria-label="`Panel ${n + 1}: ${lines.join(' ')}`" class="editorial-ink comic-ink">
      <g class="line">
        <path d="M1 1H245V269H1Z" />
        <path class="paper" d="M83 196H147L137 239H92Z" /><path d="M115 197V126M115 170Q75 169 78 142Q111 142 115 170M115 150Q149 151 155 118Q120 121 115 150M115 190Q143 189 148 168Q120 167 115 190" />
        <path d="M23 242H221" class="fine" /><path v-if="n === 1" class="paper" d="M162 170H225V216H162ZM154 220H231L237 227H148Z" /><path v-if="n === 1" d="M170 202 180 190 190 198 199 181 216 178" class="fine" />
      </g>
      <text x="14" y="20" class="small caption">{{ String(n + 1).padStart(2, '0') }}</text>
      <text v-for="(line, i) in lines" :key="line" x="123" :y="51 + i * 22" text-anchor="middle" class="caption">{{ line }}</text>
    </svg>
  </div>
</template>

<style scoped>
.editorial-ink text{font-family:Georgia,'Times New Roman',serif}
.editorial-ink text{stroke:none}
.comic-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:520px){.comic-strip{grid-template-columns:1fr;max-width:300px;margin:auto;gap:14px}}
.editorial-ink{width:100%;height:auto;display:block;color:#272724;background:#eeede6}.line{stroke:currentColor;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;fill:none}.fine{stroke:currentColor;stroke-width:1;fill:none}.paper{fill:#eeede6}.ink{fill:currentColor}.caption{fill:currentColor;font:700 14px Georgia,'Times New Roman',serif;letter-spacing:.3px}.small{font-size:11px}.tiny{font-size:9px;letter-spacing:0}.paper-text{fill:#eeede6;paint-order:stroke;stroke:#272724;stroke-width:3px}.comic-ink{background:transparent}.comic-ink .paper{fill:#f5f3ed}
</style>
