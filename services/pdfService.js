const PDFDocument = require("pdfkit");

function gerarNotaFiscal(pedido) {
  return new Promise((resolve) => {

    const doc = new PDFDocument();

    const buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => {
      resolve(Buffer.concat(buffers));
    });

    doc.fontSize(24)
       .text("DELBICOS DELIVERY", {
          align: "center"
       });

    doc.moveDown();

    doc.fontSize(18)
       .text("NOTA FISCAL");

    doc.moveDown();

    doc.fontSize(12);

    doc.text(`Pedido: ${pedido.idPedido}`);
    doc.text(`Cliente: ${pedido.nomeCliente}`);
    doc.text(`Email: ${pedido.emailCliente}`);
    doc.text(`Valor: R$ ${pedido.valor}`);
    doc.text(`Status: ${pedido.status}`);

    doc.end();
  });
}

module.exports = {
  gerarNotaFiscal
};