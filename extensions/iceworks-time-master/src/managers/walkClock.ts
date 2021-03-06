import { commands, window, WindowState } from 'vscode';
import { setNowDay, isNewDay } from '../utils/time';
import { sendPayload, checkPayloadIsLimited } from '../utils/sender';
import { checkStorageDaysIsLimited } from '../utils/storage';
import logger, { reloadLogger } from '../utils/logger';
import { getInterface as getUsageStatsRecorder } from '../recorders/usageStats';
import { checkMidnightDurationMins, snedPayloadDurationMins, processUsageStatsDurationMins } from '../config';

const usageStatsRecorder = getUsageStatsRecorder();

export async function checkMidnight() {
  if (isNewDay()) {
    setNowDay();
    reloadLogger();
    try {
      await Promise.all([
        async function () {
          await checkStorageDaysIsLimited();
        },
        async function () {
          await checkPayloadIsLimited();
          await sendPayload(true);
        },
      ]);
    } catch (e) {
      logger.error('[walkClock][checkMidnight] got error:', e);
    }
  }
}

let dayCheckTimer: NodeJS.Timeout;
let sendDataTimer: NodeJS.Timeout;
let processUsageStatsTimmer: NodeJS.Timeout;

export async function activate() {
  dayCheckTimer = setInterval(() => {
    checkMidnight();
  }, checkMidnightDurationMins);

  sendDataTimer = setInterval(() => {
    sendPayload().catch((e) => {
      logger.error('[walkClock][activate][setInterval]sendPayload got error:', e);
    });
  }, snedPayloadDurationMins);

  processUsageStatsTimmer = setInterval(() => {
    if (window.state.focused) {
      usageStatsRecorder.sendData().catch((e) => {
        logger.error('[walkClock][activate][setInterval]usageStatsRecorder got error:', e);
      });
    }
  }, processUsageStatsDurationMins);

  window.onDidChangeWindowState((windowState: WindowState) => {
    if (windowState.focused) {
      refreshViews();
    }
  });

  await checkMidnight();
  try {
    await sendPayload();
  } catch (e) {
    logger.error('[walkClock][activate]sendPayload got error:', e);
  }
}

export function deactivate() {
  if (dayCheckTimer) {
    clearInterval(dayCheckTimer);
  }
  if (sendDataTimer) {
    clearInterval(sendDataTimer);
  }
  if (processUsageStatsTimmer) {
    clearInterval(processUsageStatsTimmer);
  }
}

export function refreshViews() {
  logger.debug('[walkClock][refreshViews] run');
  commands.executeCommand('iceworks-time-master.refreshTimerTree');
  commands.executeCommand('iceworks-time-master.refreshTimerStatusBar');
}
