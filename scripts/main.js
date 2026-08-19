import { startJourney } from "./journey.js";
import { startNavigation } from "./navigation.js";
import { startReveals } from "./reveals.js?v=20260818";
import { startRocket } from "./rocket.js?v=20260818";

// each part of the page owns its own behavior
startJourney();
startNavigation();
startReveals();
startRocket();
