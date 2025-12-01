// src/app/reportes/reportes.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexDataLabels,
  ApexStroke,
  ApexTitleSubtitle,
  ApexFill,
  ApexTooltip,
  ApexYAxis,
  ApexLegend
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  xaxis: ApexXAxis;
  yaxis?: ApexYAxis;
  title?: ApexTitleSubtitle;
  fill?: ApexFill;
  tooltip?: ApexTooltip;
  legend?: ApexLegend;
};

interface ResumenResponse {
  total: number;
  ocupadas: number;
  reservadas: number;
  disponibles: number;
  porcentajeOcupacion: number;
  tarifaPromedio: number;
  revpar?: number;
}

interface IngresoMensual {
  mes: string;
  ingreso: number;
}


interface AnalyticsSummary {
  ocupacion: number;
  ocupacionDelta: number;
  adr: number;
  adrDelta: number;
  revpar: number;
  revparDelta: number;
  ingresos: number;
  ingresosDelta: number;
}

interface Movimiento {
  grupo: string;
  fechaHora: string;
  habitacion: string;
  huesped: string;
  codigo: string;
  descripcion: string;
  comprobante: string;
  moneda: string;
  cargo: number;
  pago: number;
  cajero: string;
}

interface OcupacionSemanalRow {
  semana: number;
  porcentaje: number;
}

interface MixHabitacionesRow {
  total: number;
  ocupadas: number;
  libres: number;
  mantenimiento: number;
}


type TabKey = 'analytics' | 'movimientos' | 'corte';
type RangeKey = '7d' | '30d' | 'month';


@Component({
  standalone: true,
  selector: 'app-reportes',
  imports: [CommonModule, NgIf, NgFor, NgClass, FormsModule, NgApexchartsModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.css'],
})
export class ReportesComponent implements OnInit {

    private API = 'http://localhost:5000/api/reportes';

    // KPIs cabecera
  ocupacion = 0;          // %
  adr = 0;                // tarifa promedio
  revpar = 0;             // cálculo simple
  ingresosTotales = 0;    // suma de ingresos últimos 6 meses

  // estados de habitaciones (para alguna tarjeta o texto)
  totalHabs = 0;
  ocupadas = 0;
  reservadas = 0;
  disponibles = 0;

  
  // === OPCIONES DEL GRÁFICO DE INGRESOS ===
    // lo tipamos como any para que Angular no se pelee con los tipos de Apex
    ingresosChartOptions: any = {
    series: [
        {
        name: 'Ingresos',
        data: [],
        },
    ],
    chart: {
        type: 'bar',
        height: 320,
    },
    dataLabels: {
        enabled: false,
    },
    stroke: {
        width: 0,
    },
    xaxis: {
        categories: [],
    },
    yaxis: {
        labels: {
        formatter: (val: number) => `$${val.toLocaleString('es-MX')}`,
        },
    },
    title: {
        text: '',
    },
    fill: {
        opacity: 0.9,
    },
    tooltip: {
        y: {
        formatter: (val: number) => `$${val.toLocaleString('es-MX')}`,
        },
    },
    legend: {
        show: false,
    },
    };


  cargando = true;
  error = '';
  // ===== Tabs =====
  selectedTab: TabKey = 'analytics';

  // ===== Rangos de tiempo (Analíticas) =====
  selectedRange: RangeKey = '30d';

  constructor(private http: HttpClient) {}

  analytics: AnalyticsSummary = {
    ocupacion: 0,
    ocupacionDelta: 0,
    adr: 0,
    adrDelta: 0,
    revpar: 0,
    revparDelta: 0,
    ingresos: 0,
    ingresosDelta: 0,
  };

  // ===== Gráficas (datos de ejemplo) =====
  ingresosChart: any;
  ocupacionChart: any;
  mixChart: any;

  // ===== Filtros Movimientos (solo UI por ahora) =====
  fechaDesde: string | null = null;
  fechaHasta: string | null = null;
  agruparPor: 'codigo' | 'cajero' = 'codigo';
  cajeroFiltro: string = 'todos';

  // ===== Datos de ejemplo para movimientos =====
  movimientos: Movimiento[] = [];

  cajerosUnicos: string[] = [];


  ngOnInit(): void {
    this.initCharts();        // seguimos usando las gráficas dummy por ahora
    this.cargarResumen(this.selectedRange);     // aquí jalamos datos reales para las cards
    this.cargarIngresosMensuales();
    this.cargarIngresosPorRango(this.selectedRange); // aquí
    this.cargarOcupacionSemanal();   
    this.cargarMixHabitaciones(); 
    this.aplicarFiltrosMovimientos();
    }


  // ===== Getters útiles =====
  get rangeLabel(): string {
    switch (this.selectedRange) {
      case '7d':
        return 'Últimos 7 días';
      case '30d':
        return 'Últimos 30 días';
      case 'month':
        return 'Este mes';
    }
  }

  get movimientosAgrupados(): { grupo: string; items: Movimiento[] }[] {
    const map = new Map<string, Movimiento[]>();

    const filtrados = this.movimientos.filter((m) => {
        if (this.cajeroFiltro !== 'todos' && m.cajero !== this.cajeroFiltro) {
        return false;
        }
        return true;
    });

    for (const m of filtrados) {
        if (!map.has(m.grupo)) {
        map.set(m.grupo, []);
        }
        map.get(m.grupo)!.push(m);
    }

    return Array.from(map.entries()).map(([grupo, items]) => ({ grupo, items }));
    }



  get totalCargos(): number {
    return this.movimientosAgrupados
        .flatMap((g) => g.items)
        .reduce((sum, m) => sum + (m.cargo ?? 0), 0);
    }

    get totalPagos(): number {
    return this.movimientosAgrupados
        .flatMap((g) => g.items)
        .reduce((sum, m) => sum + (m.pago ?? 0), 0);
    }

    get saldoNeto(): number {
    return this.totalCargos - this.totalPagos;
    }


  // ===== Métodos UI =====
  selectTab(tab: TabKey) {
    this.selectedTab = tab;
  }

  selectRange(range: RangeKey) {
    this.selectedRange = range;
    this.cargarResumen(range);
    this.cargarIngresosPorRango(range);
    // Aquí luego vas a llamar al backend:
    // this.reportesService.getAnalytics(range).subscribe(...)
  }

  aplicarFiltrosMovimientos() {
    const params: any = {
        agruparPor: this.agruparPor,
    };

    if (this.fechaDesde) {
        params.fechaDesde = this.fechaDesde;   // 'YYYY-MM-DD'
    }

    if (this.fechaHasta) {
        params.fechaHasta = this.fechaHasta;   // 'YYYY-MM-DD'
    }

    if (this.cajeroFiltro && this.cajeroFiltro !== 'todos') {
        params.cajero = this.cajeroFiltro;
    }

    this.http
        .get<Movimiento[]>(`${this.API}/movimientos`, { params })
        .subscribe({
        next: (data) => {
            console.log('Movimientos recibidos:', data);
            this.movimientos = data;

            // sacar cajeros únicos
            const nombres = Array.from(
            new Set(
                data
                .map((m) => m.cajero)
                .filter((c) => !!c) // quitar null/undefined/vacíos
            )
            );
            this.cajerosUnicos = nombres;
        },
        error: (err) => {
            console.error('Error cargando movimientos:', err);
        },
        });
    }


  reiniciarFiltros() {
    this.fechaDesde = null;
    this.fechaHasta = null;
    this.agruparPor = 'codigo';
    this.cajeroFiltro = 'todos';

    this.aplicarFiltrosMovimientos();
  }

  private cargarResumen(range: RangeKey = '30d') {
    this.cargando = true;

    this.http
        .get<ResumenResponse>(`${this.API}/resumen`, {
        params: { range },
        })
        .subscribe({
        next: (res) => {
            console.log('Resumen reportes:', res);

            this.totalHabs = res.total;
            this.ocupadas = res.ocupadas;
            this.reservadas = res.reservadas;
            this.disponibles = res.disponibles;

            this.ocupacion = res.porcentajeOcupacion ?? 0;
            this.adr = Number(res.tarifaPromedio ?? 0);

            // Usar revpar del backend si viene, si no calcularlo como antes
            if (res.revpar != null) {
            this.revpar = Math.round(res.revpar);
            } else {
            this.revpar = Math.round(this.adr * (this.ocupacion / 100));
            }

            this.cargando = false;
        },
        error: (err) => {
            console.error('Error cargando resumen:', err);
            this.error = 'Error al cargar resumen de reportes';
            this.cargando = false;
        },
        });
    }


  private cargarIngresosMensuales() {
    this.http.get<IngresoMensual[]>(`${this.API}/ingresos-mensuales`).subscribe({
      next: (data) => {
        console.log('Ingresos mensuales:', data);

        const seriesData = data.map(d => d.ingreso);
        const categories = data.map(d => d.mes);

        // total de ingresos para la tarjeta
        this.ingresosTotales = seriesData.reduce((acc, v) => acc + v, 0);

        // actualizamos solo los campos necesarios
        this.ingresosChartOptions.series = [
          {
            name: 'Ingresos',
            data: seriesData,
          },
        ];
        this.ingresosChartOptions.xaxis = {
          categories,
        };
        this.ingresosChartOptions.yaxis = {
          labels: {
            formatter: (val: number) => `$${val.toLocaleString('es-MX')}`,
          },
        };
      },
      error: (err) => {
        console.error('Error cargando ingresos mensuales:', err);
      }
    });
  }

  private cargarIngresosPorRango(range: RangeKey) {
    this.http
        .get<{ range: string; totalIngresos: number }>(
        `${this.API}/ingresos-rango`,
        { params: { range } }
        )
        .subscribe({
        next: (res) => {
            console.log('Ingresos por rango:', res);
            this.ingresosTotales = res.totalIngresos ?? 0;
        },
        error: (err) => {
            console.error('Error cargando ingresos por rango:', err);
        },
        });
    }

    private cargarOcupacionSemanal() {
        this.http
            .get<{ semana: number; ocupacion: number | string }[]>(
            `${this.API}/ocupacion-semanal`
            )
            .subscribe({
            next: (rows) => {
                console.log('Ocupación semanal:', rows);

                // etiquetas S3, S4, S5...
                const categories = rows.map((r) => `S${r.semana}`);
                // nos aseguramos de convertir a número
                const data = rows.map((r) => Number(r.ocupacion) || 0);

                this.ocupacionChart = {
                ...this.ocupacionChart,
                xaxis: {
                    ...this.ocupacionChart.xaxis,
                    categories,
                },
                series: [
                    {
                    name: 'Ocupación',
                    data,
                    },
                ],
                };
            },
            error: (err) => {
                console.error('Error cargando ocupación semanal:', err);
            },
            });
        }


    
    private cargarMixHabitaciones() {
        this.http
            .get<MixHabitacionesRow>(`${this.API}/mix-habitaciones`)
            .subscribe({
            next: (res) => {
                if (!res) return;

                const total =
                res.total ||
                res.ocupadas + res.libres + res.mantenimiento ||
                0;

                if (!total) {
                this.mixChart = {
                    ...this.mixChart,
                    series: [0, 0, 0],
                };
                return;
                }

                const pctOcupadas = (res.ocupadas / total) * 100;
                const pctLibres = (res.libres / total) * 100;
                const pctMant = (res.mantenimiento / total) * 100;

                this.mixChart = {
                ...this.mixChart,
                series: [
                    Number(pctOcupadas.toFixed(1)),
                    Number(pctLibres.toFixed(1)),
                    Number(pctMant.toFixed(1)),
                ],
                };
            },
            error: (err) => {
                console.error('Error cargando mix de habitaciones:', err);
            },
            });
        }





  // ===== Configuración de gráficas dummy =====
  private initCharts() {
    this.ingresosChart = {
      series: [
        {
          name: 'Ingresos',
          data: [44000, 38000, 60500, 50000, 72000, 81000],
        },
      ],
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
      },
      plotOptions: {
        bar: {
          borderRadius: 6,
          columnWidth: '40%',
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
      },
      grid: {
        strokeDashArray: 4,
      },
    };

    this.ocupacionChart = {
      series: [
        {
          name: 'Ocupación',
          data: [64, 71, 77, 81],
        },
      ],
      chart: {
        type: 'line',
        height: 260,
        toolbar: { show: false },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      markers: {
        size: 4,
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['S1', 'S2', 'S3', 'S4'],
      },
      yaxis: {
        max: 100,
        min: 0,
        tickAmount: 4,
        labels: {
          formatter: (val: number) => `${val}%`,
        },
      },
      grid: {
        strokeDashArray: 4,
      },
    };

    this.mixChart = {
      series: [60, 30, 10],
      chart: {
        type: 'donut',
        height: 260,
      },
      labels: ['Ocupadas', 'Libres', 'Mantenimiento'],
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val.toFixed(1)}%`,
      },
      legend: {
        position: 'bottom',
      },
    };
  }


  private formatFecha(fechaIso: string): string {
  if (!fechaIso) return '';
  const d = new Date(fechaIso);
  // dd/mm/aaaa hh:mm opcional
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  const anio = d.getFullYear();
  const hora = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}

exportarMovimientosPDF() {
  const doc = new jsPDF('l', 'mm', 'a4'); // horizontal

  // Título
  doc.setFontSize(14);
  doc.text('Reporte de Movimientos', 14, 15);

  // Subtítulo con filtros actuales
  doc.setFontSize(10);
  const rango = `Rango: ${this.fechaDesde || '—'}  al  ${this.fechaHasta || '—'}`;
  const agrupar = `Agrupar por: ${this.agruparPor === 'codigo' ? 'Código' : 'Cajero'}`;
  doc.text(rango, 14, 22);
  doc.text(agrupar, 14, 27);

  // Construir filas a partir de movimientosAgrupados
  const body: RowInput[] = [];

  this.movimientosAgrupados.forEach((grupo) => {
    // Fila de título de grupo
    body.push([
      {
        content: grupo.grupo,
        colSpan: 10,
        styles: {
          fontStyle: 'bold',
          fillColor: [240, 240, 240],
          halign: 'left',
        },
      },
    ] as any);

    // Filas detalle
    grupo.items.forEach((m) => {
      body.push([
        this.formatFecha(m.fechaHora),
        m.habitacion,
        m.huesped,
        m.codigo,
        m.descripcion,
        m.comprobante,
        m.moneda || 'MXN',
        m.cargo ? m.cargo.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—',
        m.pago ? m.pago.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—',
        m.cajero || '—',
      ]);
    });
  });

  autoTable(doc, {
    startY: 32,
    head: [[
      'Fecha·Hora',
      'Hab.',
      'Huésped',
      'Código',
      'Descripción',
      'Comprobante',
      'Moneda',
      'Cargo',
      'Pago',
      'Cajero',
    ]],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [15, 118, 110], // algo turquesita Wyndham
      textColor: 255,
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 14 },
      2: { cellWidth: 30 },
      3: { cellWidth: 18 },
      4: { cellWidth: 60 },
      5: { cellWidth: 22 },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  // Totales al final (opcional)
  const totalCargos = this.totalCargos; // si ya tienes getters, reutilízalos
  const totalPagos = this.totalPagos;
  const saldo = this.saldoNeto;

  let y = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(
    `Total Cargos: ${totalCargos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
    14,
    y
  );
  y += 5;
  doc.text(
    `Total Pagos: ${totalPagos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
    14,
    y
  );
  y += 5;
  doc.text(
    `Saldo Neto: ${saldo.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}`,
    14,
    y
  );

  // Descargar
  doc.save(`reporte-movimientos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

}
