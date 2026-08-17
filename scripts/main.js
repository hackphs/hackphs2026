import { startJourney } from "./journey.js";
import { startNavigation } from "./navigation.js";
import { startReveals } from "./reveals.js";
import { startRocket } from "./rocket.js";

// each part of the page owns its own behavior
startJourney();
startNavigation();
startReveals();
startRocket();
