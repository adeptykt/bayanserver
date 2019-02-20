function eanChecksum(barcode) {
   var calcSum = 0, calcChecksum = 0

   barcode.split('').map((number, index) => {
     number = parseInt(number, 10)
     if (index % 2 === 0) calcSum += number
     else calcSum += number * 3
   })

   calcSum %= 10
   calcChecksum = (calcSum === 0) ? 0 : (10 - calcSum);

   return calcChecksum
}

function generateEan13(value) {
  const zero = (s) => ("000000" + s).slice(-7)
  const prefix = "11137"
  let barcode = prefix + zero(value.toString())
  return barcode + eanChecksum(barcode)
}

module.exports = generateEan13
