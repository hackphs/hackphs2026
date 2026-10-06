import { startJourney } from "./journey.js?v=20260925e";
import { startNavigation } from "./navigation.js";
import { startReveals } from "./reveals.js?v=20260827";
import { startRocket } from "./rocket.js?v=20260925";
import { startSchedule } from "./schedule.js?v=20261005";
import { startEventDialog } from "./event-dialog.js?v=20261005";
import { startCopyEmail } from "./copy-email.js?v=20260821";
import { startPrizePreviews } from "./prize-previews.js?v=20260917";
import { startRegistration } from "./registration.js?v=20260930";

// each part of the page owns its own behavior
startJourney();
startNavigation();
startReveals();
startRocket();
startSchedule();
startEventDialog();
startCopyEmail();
startPrizePreviews();
startRegistration();
