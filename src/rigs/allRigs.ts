/**
 * The single rig registration point. Renderer and tests both read this list;
 * a species missing here renders as the placeholder until its rig lands.
 */
import type { CreatureRig } from './format';
import { deerRig } from './deerRig';
import { dodoRig } from './dodoRig';
import { duckRig } from './duckRig';
import { koiRig } from './koiRig';
import { owlRig } from './owlRig';
import { rabbitRig } from './rabbitRig';
import { robinRig } from './robinRig';

export const ALL_RIGS: CreatureRig[] = [rabbitRig, robinRig, deerRig, duckRig, koiRig, owlRig, dodoRig];
