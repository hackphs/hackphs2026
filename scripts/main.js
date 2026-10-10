import { startJourney } from "./journey.js?v=20260925e";
import { startNavigation } from "./navigation.js";
import { startReveals } from "./reveals.js?v=20260827";
import { startRocket } from "./rocket.js?v=20260925";
import { startSchedule } from "./schedule.js?v=20261010t";
import { startEventDialog } from "./event-dialog.js?v=20261010t";
import { startEventSignups } from "./event-signups.js?v=20261010t";
import { startParticipantMap } from "./participant-map.js?v=20261009";
import { startCopyEmail } from "./copy-email.js?v=20260821";
import { startPrizePreviews } from "./prize-previews.js?v=20260917";
import { startRegistration } from "./registration.js?v=20261007";
import { startEventCountdown } from "./event-countdown.js?v=20261010b";

// each part of the page owns its own behavior
startJourney();
startNavigation();
startReveals();
startRocket();
startSchedule();
startEventDialog();
startEventSignups();
startParticipantMap();
startCopyEmail();
startPrizePreviews();
startRegistration();
startEventCountdown();
