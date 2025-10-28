/**
 * Утилиты для работы со строками
 */

/**
 * Первая буква заглавная, остальные строчные
 */
function ucFirst(str) {
  if (!str) return str;
  return (str[0].toUpperCase() + str.slice(1).toLowerCase()).trim();
}

module.exports = {
  ucFirst
};

