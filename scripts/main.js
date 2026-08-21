import { startJourney } from "./journey.js";
import { startNavigation } from "./navigation.js";
import { startReveals } from "./reveals.js?v=20260818";
import { startRocket } from "./rocket.js?v=20260818";
import { startSchedule } from "./schedule.js?v=20260821b";
import { startEventDialog } from "./event-dialog.js?v=20260820e";
import { startCopyEmail } from "./copy-email.js?v=20260821";

// each part of the page owns its own behavior
startJourney();
startNavigation();
startReveals();
startRocket();
startSchedule();
startEventDialog();
startCopyEmail();
