/**
 * Portada pública de Ruta de Carrera (SPEC «Web de la Red y área de miembros»
 * v1.0, R1; P3 = textos de la página provisoria `rutadecarrera-web`).
 *
 * Diseño mínimo a propósito: el sistema visual lo define el hilo de diseño
 * front end, que parte de esta estructura.
 */

const ANCHO = { maxWidth: 960, margin: '0 auto', padding: '0 16px' } as const;
const SECCION = { ...ANCHO, padding: '40px 16px' } as const;
const BOTON = {
  display: 'inline-block',
  padding: '12px 20px',
  borderRadius: 8,
  background: '#0f2a43',
  color: '#fff',
  textDecoration: 'none',
} as const;
const BOTON_SECUNDARIO = { ...BOTON, background: 'transparent', color: '#0f2a43', border: '1px solid #0f2a43' } as const;

const ETAPAS = [
  { n: 1, titulo: 'Brújula de Empleabilidad', lema: 'Encuentra tu dirección.', texto: 'Descubre tu valor y define tus posiciones objetivo antes de salir al mercado.' },
  { n: 2, titulo: 'La Maleta', lema: 'Prepara lo que necesitas llevar.', texto: 'Currículum, perfil de LinkedIn, elevator pitch y mensajes coherentes con tu valor.' },
  { n: 3, titulo: 'El Viaje', lema: 'Sal al encuentro de las oportunidades.', texto: 'Conversaciones de networking, reuniones, entrevistas y nuevas conexiones.' },
  { n: 4, titulo: 'El Destino', lema: 'Encuentra un lugar donde dar lo mejor de ti.', texto: 'Una posición donde tus competencias sean valoradas y puedas desarrollarte.' },
] as const;

const HERRAMIENTAS_PORTADA = [
  { titulo: 'Test DISC', estado: 'Disponible para miembros', texto: 'Conoce tu estilo de comportamiento y cómo comunicar mejor tu valor.' },
  { titulo: 'Rueda de la Vida', estado: 'Disponible', texto: 'Puntúa cada área de tu vida y descarga tu rueda.', href: '/ruedadelavida' },
  { titulo: 'Asistente de Empleabilidad', estado: 'Próximamente', texto: 'Apoyo guiado para preparar tu Maleta y tu estrategia de búsqueda.' },
  { titulo: 'Mapa de Empleabilidad digital', estado: 'Próximamente', texto: 'El recorrido completo, de la Brújula al Destino, en un solo lugar.' },
] as const;

export default function Portada() {
  return (
    <main>
      <section style={{ ...SECCION, paddingTop: 64 }}>
        <p style={{ letterSpacing: 2, textTransform: 'uppercase' }}>Ruta de Carrera</p>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.1 }}>La ruta hacia una mejor etapa laboral</h1>
        <p style={{ fontSize: '1.15rem', maxWidth: 640 }}>
          Antes de enviar currículums, necesitas saber hacia dónde quieres ir y qué valor puedes aportar.
        </p>
        <p style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <a href="#profesionales" style={BOTON}>
            Soy profesional
          </a>
          <a href="#consultores" style={BOTON_SECUNDARIO}>
            Soy consultor de carrera
          </a>
          <a href="/auth/login" style={BOTON_SECUNDARIO}>
            Entrar
          </a>
        </p>
      </section>

      <section style={SECCION} aria-labelledby="por-que">
        <h2 id="por-que">Por qué nace Ruta de Carrera</h2>
        <p>Dos dolores, una misma causa: nadie conecta a quienes buscan una nueva etapa con quienes saben acompañarla.</p>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div>
            <h3>Profesionales en transición: buscar a ciegas</h3>
            <ul>
              <li>Mandan currículums sin saber hacia qué posiciones apuntar.</li>
              <li>Arman su red desde cero, y pedir reuniones se siente incómodo.</li>
              <li>Reciben servicios genéricos, iguales para todos.</li>
            </ul>
          </div>
          <div>
            <h3>Consultores de carrera: buena técnica, poca red</h3>
            <ul>
              <li>Les cuesta vender y llegar a su cliente ideal.</li>
              <li>Trabajan solos: quieren comunidad, networking y derivaciones.</li>
              <li>Necesitan metodologías y herramientas de diagnóstico.</li>
            </ul>
          </div>
        </div>
      </section>

      <section style={SECCION} aria-labelledby="metodo">
        <h2 id="metodo">Método Mapa de Empleabilidad</h2>
        <p>El sistema que permite identificar tu valor profesional, preparar la búsqueda y conectar con las oportunidades adecuadas.</p>
        <ol style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', paddingLeft: 20 }}>
          {ETAPAS.map((e) => (
            <li key={e.n}>
              <h3 style={{ marginBottom: 4 }}>{e.titulo}</h3>
              <p style={{ margin: 0 }}>
                <em>{e.lema}</em> {e.texto}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section style={SECCION} aria-labelledby="caminos">
        <h2 id="caminos">Dos caminos, una misma ruta</h2>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div id="profesionales">
            <h3>Si estás en transición laboral</h3>
            <p>
              Dejas de buscar a ciegas y diriges tu experiencia hacia un lugar donde puedas aportar más valor, de la mano de
              un consultor de la Red.
            </p>
          </div>
          <div id="consultores">
            <h3>Si acompañas carreras</h3>
            <p>
              Estamos construyendo la red de consultores profesionales de carrera más grande de Hispanoamérica: una
              comunidad para colaborar, ganar visibilidad, compartir metodologías y derivar clientes entre colegas.
            </p>
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <a href="https://tinyurl.com/red-rutadecarrera" style={BOTON}>
                Quiero ser parte de la red
              </a>
              <a href="/auth/login" style={BOTON_SECUNDARIO}>
                Ya soy miembro: entrar
              </a>
            </p>
          </div>
        </div>
      </section>

      <section style={SECCION} aria-labelledby="herramientas">
        <h2 id="herramientas">Herramientas</h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {HERRAMIENTAS_PORTADA.map((h) => (
            <li key={h.titulo} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}>
              <small>{h.estado}</small>
              <h3 style={{ margin: '4px 0' }}>{'href' in h ? <a href={h.href}>{h.titulo}</a> : h.titulo}</h3>
              <p style={{ margin: 0 }}>{h.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section style={SECCION} aria-labelledby="quienes">
        <h2 id="quienes">Quiénes están detrás</h2>
        <p>
          Ruta de Carrera nace de la mano de Eduardo Salinas Belletti y Ninoshka Fasce, fundadores, que invitan a quienes han
          sido parte de sus experiencias de aprendizaje a construir esta red.
        </p>
      </section>

      <footer style={{ ...SECCION, borderTop: '1px solid #e5e5e5' }}>
        <p>© 2026 Ruta de Carrera · F&amp;S</p>
      </footer>
    </main>
  );
}
