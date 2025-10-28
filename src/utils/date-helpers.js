/**
 * Утилиты для работы с датами
 */

/**
 * Форматирует число с ведущим нулем
 */
function two(s) {
  return ("0" + s).slice(-2);
}

/**
 * Добавляет дни к дате
 * @param {Date} date - Исходная дата
 * @param {Number} days - Количество дней
 * @param {String} type - 'begin' | 'end' | ''
 */
function addDays(date, days, type = '') {
  const d = new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  if (type === 'end') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  if (type === 'begin') return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  return d;
}

/**
 * Начало дня
 */
function startday(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
}

/**
 * Конец дня
 */
function endday(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

/**
 * Форматирует дату в локальный формат DD.MM.YYYY
 */
function getLocalDate(d) {
  return d.getDate() + "." + two(d.getMonth() + 1) + "." + d.getFullYear();
}

/**
 * Форматирует дату и время в локальный формат
 */
function toJSONLocal(date) {
  const d = new Date(date);
  return d.getDate() + "." + two(d.getMonth() + 1) + "." + two(d.getFullYear()) + 
         " " + two(d.getHours()) + ":" + two(d.getMinutes()) + ":" + two(d.getSeconds());
}

/**
 * Форматирует дату для отображения
 */
function formatDate(d) {
  if (isDate(d)) {
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return day + '.' + month + '.' + year;
  }
  return '';
}

/**
 * Проверяет, является ли значение датой
 */
function isDate(date) {
  return date instanceof Date && !isNaN(date.valueOf());
}

/**
 * Парсит дату из строки формата YYYY.MM.DD
 */
function parseDate(str) {
  if (typeof str !== 'string') {
    return undefined;
  }
  const split = str.split('.');
  if (split.length !== 3) {
    return undefined;
  }
  const year = parseInt(split[0], 10);
  const month = parseInt(split[1], 10) - 1;
  const day = parseInt(split[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day) || 
      day <= 0 || day > 31 || month < 0 || month >= 12) {
    return undefined;
  }
  return new Date(year, month, day);
}

module.exports = {
  two,
  addDays,
  startday,
  endday,
  getLocalDate,
  toJSONLocal,
  formatDate,
  isDate,
  parseDate
};

