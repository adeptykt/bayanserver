/**
 * Планировщик задач (cron)
 */

const cron = require('node-cron');
const exec = require('child_process').exec;
const BonusService = require('../services/bonus.service');

function two(s) {
  return ("0" + s).slice(-2);
}

function date(d) {
  return two(d.getYear()) + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
}

module.exports = function(app) {
  const bonusService = new BonusService(app);

  /**
   * Ежедневное резервное копирование MongoDB в 01:00
   */
  cron.schedule("0 0 1 * * *", () => {
    const backupPath = process.env.BACKUP_PATH || 'e:\\Dropbox\\backups\\';
    const mongoPath = process.env.MONGO_PATH || 'c:\\Program Files\\MongoDB\\Server\\3.4\\bin\\mongodump.exe';
    const dbName = process.env.MONGO_DB || 'fserver';
    
    exec(`"${mongoPath}" --db ${dbName} --out ${backupPath}${date(new Date())}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Backup error: ${error}`);
        return;
      }
      console.log(`Backup stdout: ${stdout}`);
      if (stderr) console.log(`Backup stderr: ${stderr}`);
    });
  });

  /**
   * Ежедневное списание просроченных бонусов в 23:59
   */
  cron.schedule("0 59 23 * * *", () => {
    console.log('Running cron: checkExpired writeOff');
    bonusService.checkExpired('writeOff');
  });

  /**
   * Ежедневная отправка SMS о истекающих бонусах в 09:00
   */
  cron.schedule("0 0 9 * * *", () => {
    console.log('Running cron: checkExpired sendSMS');
    bonusService.checkExpired('sendSMS');
  });

  console.log('Cron tasks initialized');
};

