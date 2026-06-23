import { useState } from "react";

function App() {
  const [eventos, setEventos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [cupo, setCupo] = useState("");
  const [precio, setPrecio] = useState("");

  const agregarEvento = () => {
    if (!nombre || !fecha || !cupo || !precio) {
      alert("Complete todos los campos");
      return;
    }

    const nuevoEvento = {
      id: Date.now(),
      nombre,
      fecha,
      cupo,
      precio,
    };

    setEventos([...eventos, nuevoEvento]);

    setNombre("");
    setFecha("");
    setCupo("");
    setPrecio("");
  };

  const eliminarEvento = (id) => {
    setEventos(eventos.filter((evento) => evento.id !== id));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>🎟️ Ticketera de Eventos</h1>

      <h2>Crear Evento</h2>

      <input
        type="text"
        placeholder="Nombre del evento"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <br /><br />

      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />
      <br /><br />

      <input
        type="number"
        placeholder="Cupo"
        value={cupo}
        onChange={(e) => setCupo(e.target.value)}
      />
      <br /><br />

      <input
        type="number"
        placeholder="Precio"
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
      />
      <br /><br />

      <button onClick={agregarEvento}>
        Crear Evento
      </button>

      <hr />

      <h2>Eventos Registrados</h2>

      {eventos.length === 0 ? (
        <p>No existen eventos registrados.</p>
      ) : (
        eventos.map((evento) => (
          <div key={evento.id}>
            <h3>{evento.nombre}</h3>
            <p>📅 Fecha: {evento.fecha}</p>
            <p>👥 Cupo: {evento.cupo}</p>
            <p>💰 Precio: Bs. {evento.precio}</p>

            <button onClick={() => eliminarEvento(evento.id)}>
              Eliminar
            </button>

            <hr />
          </div>
        ))
      )}
    </div>
  );
}

export default App;