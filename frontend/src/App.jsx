import { useState, useEffect } from "react";

function App() {
  const [eventos, setEventos] = useState([]);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [cupo, setCupo] = useState("");
  const [precio, setPrecio] = useState("");

  useEffect(() => {
    obtenerEventos();
  }, []);

  const obtenerEventos = async () => {
    try {
      const response = await fetch("http://localhost:3001/events");
      const data = await response.json();
      setEventos(data);
    } catch (error) {
      console.error("Error al obtener eventos:", error);
    }
  };

  const agregarEvento = async () => {
    if (!nombre || !fecha || !cupo || !precio) {
      alert("Complete todos los campos");
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nombre,
          description: "Evento creado desde React",
          date: fecha,
          capacity: parseInt(cupo),
          price: parseFloat(precio),
        }),
      });

      if (response.ok) {
        obtenerEventos();

        setNombre("");
        setFecha("");
        setCupo("");
        setPrecio("");
      }
    } catch (error) {
      console.error("Error al crear evento:", error);
    }
  };

  const eliminarEvento = async (id) => {
    try {
      await fetch(`http://localhost:3001/events/${id}`, {
        method: "DELETE",
      });

      obtenerEventos();
    } catch (error) {
      console.error("Error al eliminar evento:", error);
    }
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
            <h3>{evento.name}</h3>
            <p>📅 Fecha: {evento.date}</p>
            <p>👥 Cupo: {evento.capacity}</p>
            <p>💰 Precio: Bs. {evento.price}</p>

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