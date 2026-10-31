import { Injectable } from '@angular/core';
import { etiquetaPeriodo } from '../utils/dashboard-calculos';
import type {
  ActividadPeriodo,
  PeriodoInforme,
  ResumenDashboard,
} from '../utils/dashboard-calculos';

export interface DatosInforme {
  periodo: PeriodoInforme;
  actualizado: string;
  resumen: ResumenDashboard;
  actividad: ActividadPeriodo[];
  estados: { etiqueta: string; cantidad: number }[];
}

@Injectable({ providedIn: 'root' })
export class InformesService {
  descargarCsv(informe: DatosInforme): void {
    const filas = [['Sección', 'Concepto', 'Valor'], ...this.prepararFilas(informe)];
    const contenido = filas.map((fila) => fila.map((valor) =>
      `"${valor.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const archivo = new Blob(['\uFEFF', contenido], { type: 'text/csv;charset=utf-8;' });
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
      import('jspdf'), import('jspdf-autotable'),
    ]);
    const documento = new jsPDF();
    const generado = new Date().toLocaleString('es-ES');
    autoTable(documento, {
      head: [['Sección', 'Concepto', 'Valor']],
      body: this.prepararFilas(informe),
      startY: 40,
      margin: { top: 40, bottom: 20, left: 14, right: 14 },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [120, 44, 64] },
      columnStyles: { 0: { cellWidth: 36 }, 1: { cellWidth: 104 }, 2: { cellWidth: 42 } },
      rowPageBreak: 'avoid',
      didDrawPage: () => {
        documento.setFontSize(16);
        documento.text('Vinyl Store - Estadísticas', 14, 16);
        documento.setFontSize(9);
        documento.text(`Generado: ${generado}`, 14, 24);
        documento.text(`Periodo: ${etiquetaPeriodo(informe.periodo)} (ambos días incluidos)`, 14, 31);
      },
    });
    const paginas = documento.getNumberOfPages();
    for (let pagina = 1; pagina <= paginas; pagina++) {
      documento.setPage(pagina);
      documento.setFontSize(9);
      documento.text(`Página ${pagina} de ${paginas}`, 14, documento.internal.pageSize.getHeight() - 10);
    }
    documento.save(`${this.nombreArchivo(informe)}.pdf`);
  }

  private prepararFilas(informe: DatosInforme): string[][] {
    const resumen = informe.resumen;
    const moneda = (valor: number) => new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: 'EUR',
    }).format(valor).replace(/[\u00a0\u202f]/g, ' ');
    const actividad = informe.periodo.agrupacion === 'mensual' ? 'mensual' : 'diaria';

    return [
      ['Alcance', 'Periodo (fechas locales, ambos días incluidos)', etiquetaPeriodo(informe.periodo)],
      ['Alcance', 'Última actualización de datos', informe.actualizado],
      ['Alcance', 'Productos y stock', 'Situación actual'],
      ['Alcance', 'Reservas creadas', 'Filtradas por fecha de creación'],
      ['Alcance', 'Ventas y compras', 'Filtradas por fecha de recogida'],
      ['Alcance', 'Cancelaciones registradas', 'Filtradas por fecha de cancelación'],
      ['Alcance', 'Anillo y pendientes', 'Estado actual de las creadas en el periodo'],
      ['Productos', 'Productos registrados', String(resumen.productos)],
      ['Productos', 'Productos publicados', String(resumen.activos)],
      ['Productos', 'Unidades disponibles', String(resumen.stock)],
      ['Reservas', 'Creadas en el periodo', String(resumen.reservas)],
      ['Reservas', 'Todavía pendientes de las creadas', String(resumen.pendientes)],
      ['Compras', 'Compras completadas', String(resumen.compras)],
      ['Compras', 'Ventas', moneda(resumen.importeRecogidas)],
      ['Cancelaciones', 'Registradas en el periodo', String(resumen.cancelaciones)],
      ...informe.estados.map((estado) => ['Estados actuales', estado.etiqueta, String(estado.cantidad)]),
      ...informe.actividad.flatMap((fila) => [
        [`Actividad ${actividad}`, `${fila.fecha} - Reservas creadas`, String(fila.cantidad)],
        [`Actividad ${actividad}`, `${fila.fecha} - Compras completadas`, String(fila.compras)],
        [`Actividad ${actividad}`, `${fila.fecha} - Ventas`, moneda(fila.ventas)],
      ]),
    ];
  }

  private nombreArchivo(informe: DatosInforme): string {
    return `vinyl-store-estadisticas-${informe.periodo.desde}-${informe.periodo.hasta}`;
  }
}
