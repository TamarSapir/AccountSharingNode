function calculatePayments(items) {
  const payments = {};

  for (const item of items) {
    const { price, totalQuantity, paidBy } = item;

    // price per single unit
    const unitPrice = price / totalQuantity;

    for (const pay of paidBy) {
      const userId = pay.userId._id.toString();
      const username = pay.userId.username;
      const share = pay.quantity * unitPrice;

      if (!payments[userId]) {
        payments[userId] = { username, totalPaid: 0 };
      }
      payments[userId].totalPaid += share;
    }
  }

  return payments;
}

module.exports = calculatePayments