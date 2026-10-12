uniform sampler2D uBakedTexture;
uniform sampler2D uBakedLightTexture;

uniform vec3 uRedAccent;
uniform float uRedAccentStrength;

uniform vec3 uGreenAccent;
uniform float uGreenAccentStrength;

uniform vec3 uBlueAccent;
uniform float uBlueAccentStrength;

// 0 with the room's lights on, 1 with them off for the night.
uniform float uNight;

varying vec2 vUv;

#pragma glslify: blend = require(glsl-blend/lighten)

void main() {
	vec3 bakedColor = texture2D(uBakedTexture, vUv).rgb;
	vec3 lightMapColor = texture2D(uBakedLightTexture, vUv).rgb;

	// Night: the lamps are baked into the texture, so they are dimmed here, toward
	// a cool moonlit version of the same room. Screens and LEDs are added after,
	// so anything still switched on keeps glowing in the dark.
	bakedColor = mix(bakedColor, bakedColor * vec3(0.12, 0.16, 0.3), uNight);

	float redAccentStrength = lightMapColor.r * uRedAccentStrength;
	bakedColor = blend(bakedColor, uRedAccent, redAccentStrength);

	float greenAccentStrength = lightMapColor.g * uGreenAccentStrength;
	bakedColor = blend(bakedColor, uGreenAccent, greenAccentStrength);

	float blueAccentStrength = lightMapColor.b * uBlueAccentStrength;
	bakedColor = blend(bakedColor, uBlueAccent, blueAccentStrength);

	// 3rd param < 0 = transparent, > 1 = opaque
	float alpha = smoothstep(0.0, 1.0, 1.0);

	gl_FragColor = vec4(bakedColor, alpha);

	#include <colorspace_fragment>
}
