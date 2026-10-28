import { Injectable } from '@angular/core';

export interface DatosInforme {
  dias: number;
  resumen: {
    productos: number;
    activos: number;
    stock: number;
    reservas: number;
    pendientes: number;
    importeRecogidas: number;
  };
  actividad: { fecha: string; cantidad: number }[];
  estados: { etiqueta: string; cantidad: number }[];
}

@Injectable({
  providedIn: 'root',
})
export class InformesService {
  descargarCsv(informe: DatosInforme): void {
    const filas = [
      ['Sección', 'Concepto', 'Valor'],
      ...this.prepararFilas(informe),
    ];

    const contenido = filas
      .map((fila) =>
        fila
          .map((valor) => `"${valor.replace(/"/g, '""')}"`)
          .join(';'),
      )
      .join('\r\n');

    const archivo = new Blob(['\uFEFF', contenido], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download = `${this.nombreArchivo(informe)}.csv`;

    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async descargarPdf(informe: DatosInforme): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const documento = new jsPDF();
    const generado = new Date().toLocaleString('es-ES');

    autoTable(documento, {
      head: [['Sección', 'Concepto', 'Valor']],
      body: this.prepararFilas(informe),
      startY: 38,
      margin: {
        top: 38,
        bottom: 20,
        left: 14,
        right: 14,
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [35, 58, 89],
      },
      columnStyles: {
        0: { cellWidth: 36 },
        1: { cellWidth: 104 },
        2: { cellWidth: 42 },
      },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        documento.setFontSize(16);
        documento.text('Vinyl Store - Estadísticas', 14, 16);

        documento.setFontSize(9);
        documento.text(`Generado: ${generado}`, 14, 24);
        documento.text(
          `Reservas creadas en los últimos ${informe.dias} días, incluido hoy.`,
          14,
          30,
        );
      },
    });

    const paginas = documento.getNumberOfPages();

    for (let pagina = 1; pagina <= paginas; pagina++) {
      documento.setPage(pagina);
      documento.setFontSize(9);
      documento.text(
        `Página ${pagina} de ${paginas}`,
        14,
        documento.internal.pageSize.getHeight() - 10,
      );
    }

    documento.save(`${this.nombreArchivo(informe)}.pdf`);
  }

  private prepararFilas(informe: DatosInforme): string[][] {
    const resumen = informe.resumen;

    const importe = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    })
      .format(resumen.importeRecogidas)
      .replace(/[\u00a0\u202f]/g, ' ');

    return [
      ['Alcance', 'Periodo de reservas, incluido hoy', `${informe.dias} días`],
      ['Alcance', 'Productos y stock', 'Situación actual'],
      ['Alcance', 'Estados de las reservas', 'Estado actual de las del periodo'],
      ['Productos', 'Productos registrados', String(resumen.productos)],
      ['Productos', 'Productos activos', String(resumen.activos)],
      ['Productos', 'Unidades disponibles en catálogo', String(resumen.stock)],
      ['Reservas', 'Reservas creadas en el periodo', String(resumen.reservas)],
      ['Reservas', 'Todavía pendientes', String(resumen.pendientes)],
      ['Reservas', 'Valor de reservas recogidas del periodo', importe],
      ...informe.estados.map((estado) => [
        'Estados',
        estado.etiqueta,
        String(estado.cantidad),
      ]),
      ...informe.actividad.map((dia) => [
        'Actividad diaria',
        dia.fecha,
        String(dia.cantidad),
      ]),
    ];
  }

  private nombreArchivo(informe: DatosInforme): string {
    const fecha = new Intl.DateTimeFormat('sv-SE').format(new Date());
    return `vinyl-store-estadisticas-${informe.dias}-dias-${fecha}`;
  }
}