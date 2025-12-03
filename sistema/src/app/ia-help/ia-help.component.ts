import { Component, signal, computed } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

interface Mensaje {
  type: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-ia-help',
  standalone: true,
  imports: [CommonModule, NgFor, NgIf, FormsModule],
  templateUrl: './ia-help.component.html',
  styleUrls: ['./ia-help.component.css']
})
export class IaHelpComponent {
  abierto = signal(false);

  mensajes = signal<Mensaje[]>([
    { type: 'assistant', text: 'Hola ¿en qué puedo ayudarte dentro del sistema?' }
  ]);

  escribiendo = signal(false);
  pregunta = signal('');
  //respuesta = signal('');


  constructor(private http: HttpClient) {}

  togglePanel() {
    this.abierto.set(!this.abierto());
  }

  async enviar() {
    const texto = this.pregunta().trim();
    if (!texto) return;

    // Añadir mensaje del usuario
    this.mensajes.update(list => [...list, { type: 'user', text: texto }]);
    this.pregunta.set('');
    this.escribiendo.set(true);

    try {
      // Llamada al backend (URL correcta)
      const resp = await firstValueFrom(
        this.http.post<any>(
          'http://localhost:5000/api/ia/ask',
          { pregunta: texto }
        )
      );

      const respuestaTexto = resp?.respuesta || 'No hubo respuesta';

      // Añadir respuesta al chat
      this.mensajes.update(list => [
        ...list,
        { type: 'assistant', text: respuestaTexto }
      ]);

      // Guardar respuesta para mostrar en el panel
      //this.respuesta.set(respuestaTexto);

    } catch (e) {
      console.error(e);

      this.mensajes.update(list => [
        ...list,
        { type: 'assistant', text: 'Error consultando IA' }
      ]);
      Swal.fire({
        icon: 'error',
        title: 'Error al consultar la IA',
        text: 'Hubo un problema obteniendo la respuesta.',
        confirmButtonColor: '#00AEB3'
      });
    }

    this.escribiendo.set(false);
  }

}
