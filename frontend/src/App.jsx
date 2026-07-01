import { useEffect, useMemo, useState } from "react";
import "./App.css";

const EVENTS_API_BASE_URL =
  import.meta.env.VITE_EVENTS_API_URL || "http://localhost:3001";
const INVENTORY_API_BASE_URL =
  import.meta.env.VITE_INVENTORY_API_URL || "http://localhost:3002";
const PAYMENTS_API_BASE_URL =
  import.meta.env.VITE_PAYMENTS_API_URL || "http://localhost:3003";

const initialForm = {
  name: "",
  description: "",
  date: "",
  capacity: "",
  price: "",
};

function App() {
  const [currentView, setCurrentView] = useState("events");
  const [events, setEvents] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [ticketForm, setTicketForm] = useState({ users: "", quantity: 1 });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [ticketStatus, setTicketStatus] = useState(null);
  const [inventoryDetail, setInventoryDetail] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [paymentLookupInventoryId, setPaymentLookupInventoryId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  useEffect(() => {
    fetchEvents();
    fetchInventoryRecords();
    fetchPayments();
  }, []);

  const eventCountText = useMemo(() => {
    if (events.length === 0) return "No hay eventos registrados";
    if (events.length === 1) return "1 evento registrado";
    return `${events.length} eventos registrados`;
  }, [events.length]);

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: "", message: "" });
    }, 3000);
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${EVENTS_API_BASE_URL}/events`);
      if (!response.ok) throw new Error("No se pudo obtener la lista de eventos");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      showFeedback("error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventById = async (id) => {
    const response = await fetch(`${EVENTS_API_BASE_URL}/events/${id}`);
    if (!response.ok) throw new Error("No se pudo cargar el evento para editar");
    return response.json();
  };

  const fetchInventoryRecords = async () => {
    try {
      const response = await fetch(`${INVENTORY_API_BASE_URL}/inventory`);
      if (!response.ok) throw new Error("No se pudo obtener el inventario");
      const data = await response.json();
      setInventoryRecords(data);
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await fetch(`${PAYMENTS_API_BASE_URL}/payments`);
      if (!response.ok) throw new Error("No se pudo obtener la lista de pagos");
      const data = await response.json();
      setPayments(data);
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const clearForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const validateForm = () => {
    if (!form.name || !form.description || !form.date || !form.capacity || !form.price) {
      throw new Error("Completa todos los campos del formulario");
    }

    if (Number(form.capacity) <= 0) {
      throw new Error("El cupo debe ser mayor a 0");
    }

    if (Number(form.price) <= 0) {
      throw new Error("El precio debe ser mayor a 0");
    }
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    try {
      validateForm();

      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        date: form.date,
        capacity: Number(form.capacity),
        price: Number(form.price),
      };

      const url = editingId
        ? `${EVENTS_API_BASE_URL}/events/${editingId}`
        : `${EVENTS_API_BASE_URL}/events`;
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          editingId
            ? "No se pudo actualizar el evento"
            : "No se pudo crear el evento"
        );
      }

      await fetchEvents();
      clearForm();
      showFeedback(
        "success",
        editingId ? "Evento actualizado correctamente" : "Evento creado correctamente"
      );
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const editEvent = async (id) => {
    try {
      const eventData = await fetchEventById(id);
      setForm({
        name: eventData.name || "",
        description: eventData.description || "",
        date: eventData.date ? eventData.date.slice(0, 16) : "",
        capacity: eventData.capacity || "",
        price: eventData.price || "",
      });
      setEditingId(id);
      showFeedback("success", `Editando evento #${id}`);
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const deleteEvent = async (id) => {
    const confirmDelete = window.confirm("¿Seguro que deseas eliminar este evento?");
    if (!confirmDelete) return;

    try {
      const response = await fetch(`${EVENTS_API_BASE_URL}/events/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("No se pudo eliminar el evento");

      if (editingId === id) {
        clearForm();
      }

      await fetchEvents();
      showFeedback("success", "Evento eliminado correctamente");
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "Sin fecha";
    return new Date(dateValue).toLocaleString("es-BO", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const openTicketView = (eventItem) => {
    setSelectedEvent(eventItem);
    setTicketForm({ users: "", quantity: 1 });
    setPurchaseResult(null);
    setTicketStatus(null);
    setInventoryDetail(null);
    setCurrentView("tickets");
    fetchInventoryRecords();
  };

  const goToEventsView = () => {
    setCurrentView("events");
    setSelectedEvent(null);
    setPurchaseResult(null);
    setTicketStatus(null);
    setInventoryDetail(null);
    setPaymentDetail(null);
  };

  const goToPaymentsView = () => {
    setCurrentView("payments");
    setPaymentDetail(null);
    fetchPayments();
  };

  const handleTicketInputChange = (event) => {
    const { name, value } = event.target;
    setTicketForm((previous) => ({ ...previous, [name]: value }));
  };

  const submitTicketPurchase = async (event) => {
    event.preventDefault();

    if (!selectedEvent) {
      showFeedback("error", "Selecciona un evento para comprar");
      return;
    }

    if (!ticketForm.users.trim()) {
      showFeedback("error", "Ingresa el nombre del comprador");
      return;
    }

    if (Number(ticketForm.quantity) <= 0) {
      showFeedback("error", "La cantidad debe ser mayor a 0");
      return;
    }

    try {
      const response = await fetch(`${INVENTORY_API_BASE_URL}/inventory/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          users: ticketForm.users.trim(),
          quantity: Number(ticketForm.quantity),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo procesar la compra");
      }

      setPurchaseResult(data);
      setTicketStatus(null);
      await fetchEvents();
      await fetchInventoryRecords();
      showFeedback("success", "Solicitud de compra enviada correctamente");
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const checkTicketStatus = async () => {
    if (!purchaseResult?.inventory_id) return;

    try {
      const response = await fetch(
        `${INVENTORY_API_BASE_URL}/inventory/${purchaseResult.inventory_id}`
      );

      if (!response.ok) {
        throw new Error("No se pudo consultar el estado del ticket");
      }

      const data = await response.json();
      setTicketStatus(data);
      await fetchEvents();
      await fetchInventoryRecords();
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const viewInventoryDetail = async (inventoryId) => {
    try {
      const response = await fetch(`${INVENTORY_API_BASE_URL}/inventory/${inventoryId}`);
      if (!response.ok) {
        throw new Error("No se pudo obtener el detalle del registro");
      }

      const data = await response.json();
      setInventoryDetail(data);
      showFeedback("success", `Mostrando detalle de inventory #${inventoryId}`);
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const viewPaymentByInventoryId = async (inventoryId) => {
    try {
      const response = await fetch(
        `${PAYMENTS_API_BASE_URL}/payments/inventory/${inventoryId}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Pago no encontrado para este inventory_id");
      }

      setPaymentDetail(data);
      showFeedback("success", `Mostrando pago del inventory #${inventoryId}`);
    } catch (error) {
      showFeedback("error", error.message);
    }
  };

  const submitPaymentLookup = async (event) => {
    event.preventDefault();
    if (!paymentLookupInventoryId.trim()) {
      showFeedback("error", "Ingresa un inventory_id para buscar su pago");
      return;
    }

    await viewPaymentByInventoryId(paymentLookupInventoryId.trim());
  };

  const totalAmount =
    selectedEvent && ticketForm.quantity
      ? Number(selectedEvent.price) * Number(ticketForm.quantity)
      : 0;

  return (
    <main className="app-shell">
      <section className="hero">
        <h1>Ticketera de Eventos</h1>
        
        <div className="view-switch">
          <button
            className={`btn ${currentView === "events" ? "btn-primary" : "btn-muted"}`}
            onClick={goToEventsView}
          >
           Eventos
          </button>
          <button
            className={`btn ${currentView === "tickets" ? "btn-primary" : "btn-muted"}`}
            onClick={() => setCurrentView("tickets")}
            disabled={!selectedEvent}
          >
            Venta tickets
          </button>
          <button
            className={`btn ${currentView === "payments" ? "btn-primary" : "btn-muted"}`}
            onClick={goToPaymentsView}
          >
            Pagos
          </button>
        </div>
      </section>

      {feedback.message && (
        <section className="panel">
          <p className={`feedback ${feedback.type}`}>{feedback.message}</p>
        </section>
      )}

      {currentView === "events" ? (
        <>
          <section className="panel form-panel">
            <h2>{editingId ? `Editar evento #${editingId}` : "Crear evento"}</h2>

            <form onSubmit={saveEvent} className="event-form">
              <label>
                Nombre del evento
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleInputChange}
                  placeholder="Ej. Concierto Maluma"
                />
              </label>

              <label>
                Descripcion
                <textarea
                  name="description"
                  rows="3"
                  value={form.description}
                  onChange={handleInputChange}
                  placeholder="Describe el evento"
                />
              </label>

              <div className="form-grid">
                <label>
                  Fecha y hora
                  <input
                    name="date"
                    type="datetime-local"
                    value={form.date}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Cupo
                  <input
                    name="capacity"
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={handleInputChange}
                    placeholder="Ej. 100"
                  />
                </label>

                <label>
                  Precio (Bs.)
                  <input
                    name="price"
                    type="number"
                    min="1"
                    step="0.01"
                    value={form.price}
                    onChange={handleInputChange}
                    placeholder="Ej. 120.50"
                  />
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Actualizar evento" : "Guardar evento"}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-muted" onClick={clearForm}>
                    Cancelar edicion
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="panel list-panel">
            <div className="list-header">
              <h2>Eventos registrados</h2>
              <div className="list-meta">
                <span>{eventCountText}</span>
                <button className="btn btn-muted" onClick={fetchEvents}>
                  Refrescar
                </button>
              </div>
            </div>

            {loading ? (
              <p className="empty-state">Cargando eventos...</p>
            ) : events.length === 0 ? (
              <p className="empty-state">Aun no hay eventos. Crea el primero.</p>
            ) : (
              <div className="event-grid">
                {events.map((eventItem) => (
                  <article key={eventItem.id} className="event-card">
                    <header>
                      <p className="event-id">ID #{eventItem.id}</p>
                      <h3>{eventItem.name}</h3>
                    </header>

                    <p className="event-description">{eventItem.description}</p>

                    <ul>
                      <li>
                        <strong>Fecha:</strong> {formatDate(eventItem.date)}
                      </li>
                      <li>
                        <strong>Cupo restante:</strong> {eventItem.capacity}
                      </li>
                      <li>
                        <strong>Precio:</strong> Bs. {Number(eventItem.price).toFixed(2)}
                      </li>
                      <li>
                        <strong>Creado:</strong> {formatDate(eventItem.created_at)}
                      </li>
                    </ul>

                    <div className="card-actions">
                      <button className="btn btn-primary" onClick={() => editEvent(eventItem.id)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" onClick={() => deleteEvent(eventItem.id)}>
                        Eliminar
                      </button>
                      <button className="btn btn-ticket" onClick={() => openTicketView(eventItem)}>
                        Comprar ticket
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : currentView === "tickets" ? (
        <section className="panel purchase-panel">
          <div className="purchase-header">
            <h2>Compra de ticket </h2>
            <button className="btn btn-muted" onClick={goToEventsView}>
              Volver a eventos
            </button>
          </div>

          {!selectedEvent ? (
            <p className="empty-state">Primero selecciona un concierto desde la vista de eventos.</p>
          ) : (
            <div className="purchase-layout">
              <article className="event-card selected-event-card">
                <header>
                  <p className="event-id">Evento seleccionado #{selectedEvent.id}</p>
                  <h3>{selectedEvent.name}</h3>
                </header>
                <p className="event-description">{selectedEvent.description}</p>
                <ul>
                  <li>
                    <strong>Fecha:</strong> {formatDate(selectedEvent.date)}
                  </li>
                  <li>
                    <strong>Cupo restante:</strong> {selectedEvent.capacity}
                  </li>
                  <li>
                    <strong>Precio unitario:</strong> Bs. {Number(selectedEvent.price).toFixed(2)}
                  </li>
                </ul>
              </article>

              <form onSubmit={submitTicketPurchase} className="event-form ticket-form">
                <label>
                  Nombre del comprador
                  <input
                    name="users"
                    type="text"
                    value={ticketForm.users}
                    onChange={handleTicketInputChange}
                    placeholder="Ej. Juan Perez"
                  />
                </label>

                <label>
                  Cantidad de tickets
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    value={ticketForm.quantity}
                    onChange={handleTicketInputChange}
                  />
                </label>

                <div className="purchase-total">
                  <span>Total estimado:</span>
                  <strong>Bs. {Number.isFinite(totalAmount) ? totalAmount.toFixed(2) : "0.00"}</strong>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-ticket">
                    Confirmar compra
                  </button>
                </div>

                {purchaseResult && (
                  <div className="result-box">
                    <p>
                      <strong>Ticket en proceso.</strong> Inventory ID: #{purchaseResult.inventory_id}
                    </p>
                    <button type="button" className="btn btn-muted" onClick={checkTicketStatus}>
                      Ver estado del ticket
                    </button>
                  </div>
                )}

                {ticketStatus && (
                  <div className="result-box status-box">
                    <p>
                      <strong>Estado actual:</strong> {ticketStatus.status}
                    </p>
                    <p>
                      <strong>Comprador:</strong> {ticketStatus.users}
                    </p>
                    <p>
                      <strong>Cantidad:</strong> {ticketStatus.quantity}
                    </p>
                    <p>
                      <strong>Fecha registro:</strong> {formatDate(ticketStatus.created_at)}
                    </p>
                  </div>
                )}
              </form>
            </div>
          )}

          <div className="inventory-history">
            <div className="list-header">
              <h3>Registros de inventory</h3>
              <button className="btn btn-muted" onClick={fetchInventoryRecords}>
                Refrescar inventario
              </button>
            </div>

            {inventoryRecords.length === 0 ? (
              <p className="empty-state">Aun no hay compras registradas.</p>
            ) : (
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Evento</th>
                      <th>Comprador</th>
                      <th>Cantidad</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRecords.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          purchaseResult?.inventory_id === item.id ? "row-current-ticket" : ""
                        }
                      >
                        <td>#{item.id}</td>
                        <td>{item.event_name || `Evento #${item.event_id}`}</td>
                        <td>{item.users}</td>
                        <td>{item.quantity}</td>
                        <td>
                          <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-muted btn-small"
                            onClick={() => viewInventoryDetail(item.id)}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inventoryDetail && (
              <div className="result-box detail-box">
                <p>
                  <strong>Detalle inventory #{inventoryDetail.id}</strong>
                </p>
                <p>
                  <strong>Event ID:</strong> {inventoryDetail.event_id}
                </p>
                <p>
                  <strong>Comprador:</strong> {inventoryDetail.users}
                </p>
                <p>
                  <strong>Cantidad:</strong> {inventoryDetail.quantity}
                </p>
                <p>
                  <strong>Estado:</strong> {inventoryDetail.status}
                </p>
                <p>
                  <strong>Creado:</strong> {formatDate(inventoryDetail.created_at)}
                </p>
                <p>
                  <strong>Actualizado:</strong> {formatDate(inventoryDetail.updated_at)}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="panel payments-panel">
          <div className="purchase-header">
            <h2>Pagos </h2>
            <button className="btn btn-muted" onClick={fetchPayments}>
              actualizar pagos
            </button>
          </div>

          <form onSubmit={submitPaymentLookup} className="payment-lookup-form">
            <label>
              Buscar pago por Inventory ID
              <input
                type="number"
                min="1"
                value={paymentLookupInventoryId}
                onChange={(event) => setPaymentLookupInventoryId(event.target.value)}
                placeholder="Ej. 12"
              />
            </label>
            <button type="submit" className="btn btn-ticket">
              Buscar pago
            </button>
          </form>

          {paymentDetail && (
            <div className="result-box detail-box">
              <p>
                <strong>Detalle del pago encontrado</strong>
              </p>
              <p>
                <strong>Payment ID:</strong> {paymentDetail.id}
              </p>
              <p>
                <strong>Inventory ID:</strong> {paymentDetail.inventory_id}
              </p>
              <p>
                <strong>Monto:</strong> Bs. {Number(paymentDetail.amount).toFixed(2)}
              </p>
              <p>
                <strong>Estado:</strong> {paymentDetail.status}
              </p>
              <p>
                <strong>Método:</strong> {paymentDetail.payment_method || "N/A"}
              </p>
              <p>
                <strong>Transacción:</strong> {paymentDetail.transaction_id || "N/A"}
              </p>
              <p>
                <strong>Creado:</strong> {formatDate(paymentDetail.created_at)}
              </p>
            </div>
          )}

          <div className="inventory-history">
            <h3>Registros de payments</h3>

            {payments.length === 0 ? (
              <p className="empty-state">Aun no hay pagos registrados.</p>
            ) : (
              <div className="inventory-table-wrapper">
                <table className="inventory-table">
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Inventory ID</th>
                      <th>Evento</th>
                      <th>Comprador</th>
                      <th>Cantidad</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((item) => (
                      <tr
                        key={item.id}
                        className={
                          paymentDetail?.id === item.id ? "row-current-ticket" : ""
                        }
                      >
                        <td>#{item.id}</td>
                        <td>#{item.inventory_id}</td>
                        <td>{item.event_name || "N/A"}</td>
                        <td>{item.users || "N/A"}</td>
                        <td>{item.quantity || 0}</td>
                        <td>Bs. {Number(item.amount).toFixed(2)}</td>
                        <td>
                          <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        </td>
                        <td>{formatDate(item.created_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-muted btn-small"
                            onClick={() => viewPaymentByInventoryId(item.inventory_id)}
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;