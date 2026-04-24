import { Tool } from '../models/tool.model';

export const demoTools: Tool[] = [
  {
    id: 'demo-taladro',
    name: 'Taladro Electrico',
    type: 'Electrica',
    category: 'Perforacion',
    description: 'Potencia 18V, bateria 2Ah e incluye maletin con brocas.',
    urlSrc: 'assets/tool-drill.svg',
    state: 'Disponible',
    material: 'Acero y ABS',
    long: 31.5,
    brand: 'Bosch',
    model: 'GSR 18V-28'
  },
  {
    id: 'demo-sierra',
    name: 'Sierra Circular',
    type: 'Corte',
    category: 'Obra',
    description: 'Disco 7-1/4, velocidad 5000 RPM y lista para corte continuo.',
    urlSrc: 'assets/tool-saw.svg',
    state: 'En Uso',
    material: 'Aluminio',
    long: 28,
    brand: 'Makita',
    model: 'LSX100'
  },
  {
    id: 'demo-lijadora',
    name: 'Lijadora Orbital',
    type: 'Acabado',
    category: 'Mantenimiento',
    description: 'Requiere cambio de pad y revision del cable de alimentacion.',
    urlSrc: 'assets/tool-sander.svg',
    state: 'Mantenimiento',
    material: 'Polimero industrial',
    long: 22,
    brand: 'DeWalt',
    model: 'DWE6423'
  },
  {
    id: 'demo-llave',
    name: 'Llave Inglesa',
    type: 'Manual',
    category: 'Ajuste',
    description: 'Tamano 8-12 pulgadas, apertura suave y uso general en taller.',
    urlSrc: 'assets/tool-wrench.svg',
    state: 'Disponible',
    material: 'Acero forjado',
    long: 24,
    brand: 'Stanley',
    model: 'STHT80640'
  },
  {
    id: 'demo-soldadora',
    name: 'Soldadora Inverter',
    type: 'Soldadura',
    category: 'Obra',
    description: 'Corriente 20-160A, accesorios incluidos y pendiente de revision.',
    urlSrc: 'assets/tool-welder.svg',
    state: 'En Uso',
    material: 'Acero pintado',
    long: 33,
    brand: 'Makita',
    model: 'SPX100'
  }
];

