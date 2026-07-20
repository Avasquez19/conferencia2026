"use strict";

/*
 * Aplicación web de Apps Script que consulta y actualiza
 * Google Sheets.
 */
const URL_APPS_SCRIPT =
  "https://script.google.com/macros/s/AKfycbyFbpWlUWo04bbKNabW-iJbnGgO9reVNo7-FCDweaDvJlSbcCRobMqeFwgUWBshBcE/exec";

const PREFIJO_CODIGO = "CONF26-";
const CLAVE_ENCARGADA = "encargadaConferencia";

let lectorQr = null;
let camaraActiva = false;
let lecturaEnProceso = false;

document.addEventListener("DOMContentLoaded", function () {
  restaurarEncargada();

  document
    .getElementById("encargada")
    .addEventListener("change", guardarEncargada);

  document
    .getElementById("codigoManual")
    .addEventListener("keydown", function (evento) {
      if (evento.key === "Enter") {
        evento.preventDefault();
        abrirBusquedaManual();
      }
    });

  mostrarModoQr();
});


function guardarEncargada() {
  const encargada =
    document.getElementById("encargada").value;

  if (encargada) {
    localStorage.setItem(CLAVE_ENCARGADA, encargada);
  } else {
    localStorage.removeItem(CLAVE_ENCARGADA);
  }
}


function restaurarEncargada() {
  const encargadaGuardada =
    localStorage.getItem(CLAVE_ENCARGADA);

  if (encargadaGuardada) {
    document.getElementById("encargada").value =
      encargadaGuardada;
  }
}


function obtenerEncargada() {
  const encargada =
    document.getElementById("encargada").value.trim();

  if (!encargada) {
    mostrarMensaje(
      "Selecciona primero a la hermana encargada.",
      "error"
    );

    document.getElementById("encargada").focus();
    return null;
  }

  return encargada;
}


async function mostrarModoQr() {
  document.getElementById("modoQr").classList.remove("oculto");
  document.getElementById("modoManual").classList.add("oculto");

  document.getElementById("tabQr").classList.add("activo");
  document.getElementById("tabManual").classList.remove("activo");

  ocultarMensaje();
}


async function mostrarModoManual() {
  await detenerCamara();

  document.getElementById("modoQr").classList.add("oculto");
  document.getElementById("modoManual").classList.remove("oculto");

  document.getElementById("tabQr").classList.remove("activo");
  document.getElementById("tabManual").classList.add("activo");

  ocultarMensaje();

  window.setTimeout(function () {
    document.getElementById("codigoManual").focus();
  }, 100);
}


async function iniciarCamara() {
  const encargada = obtenerEncargada();

  if (!encargada || camaraActiva) {
    return;
  }

  if (typeof Html5Qrcode === "undefined") {
    mostrarMensaje(
      "No fue posible cargar el lector QR. Revisa la conexión a internet.",
      "error"
    );

    return;
  }

  lecturaEnProceso = false;

  mostrarMensaje(
    "Solicitando permiso para utilizar la cámara...",
    "alerta"
  );

  lectorQr = lectorQr || new Html5Qrcode("lectorQr");

  const configuracion = {
    fps: 12,

    qrbox: function (anchoVista, altoVista) {
      const dimension = Math.floor(
        Math.min(anchoVista, altoVista) * 0.72
      );

      return {
        width: Math.max(190, dimension),
        height: Math.max(190, dimension)
      };
    },

    aspectRatio: 1
  };

  try {
    await lectorQr.start(
      {
        facingMode: {
          ideal: "environment"
        }
      },
      configuracion,
      procesarCodigoLeido,
      function () {
        /*
         * No encontrar un QR en cada fotograma es normal,
         * por eso no mostramos esos mensajes.
         */
      }
    );

    camaraActiva = true;

    document
      .getElementById("botonIniciar")
      .classList.add("oculto");

    document
      .getElementById("botonDetener")
      .classList.remove("oculto");

    ocultarMensaje();

  } catch (error) {
    camaraActiva = false;

    console.error("Error al iniciar la cámara:", error);

    mostrarMensaje(
      obtenerMensajeErrorCamara(error),
      "error"
    );
  }
}


async function detenerCamara() {
  if (!lectorQr || !camaraActiva) {
    actualizarBotonesCamara(false);
    return;
  }

  try {
    await lectorQr.stop();

    /*
     * clear() puede fallar en algunos estados intermedios;
     * no debe impedir que continúe la aplicación.
     */
    try {
      await lectorQr.clear();
    } catch (errorClear) {
      console.warn(
        "No se pudo limpiar completamente el lector:",
        errorClear
      );
    }

  } catch (error) {
    console.warn("No se pudo detener la cámara:", error);

  } finally {
    camaraActiva = false;
    actualizarBotonesCamara(false);
  }
}


function actualizarBotonesCamara(activa) {
  document
    .getElementById("botonIniciar")
    .classList.toggle("oculto", activa);

  document
    .getElementById("botonDetener")
    .classList.toggle("oculto", !activa);
}


async function procesarCodigoLeido(textoDecodificado) {
  if (lecturaEnProceso) {
    return;
  }

  lecturaEnProceso = true;

  const codigo = normalizarCodigo(textoDecodificado);

  if (!esCodigoValido(codigo)) {
    lecturaEnProceso = false;

    mostrarMensaje(
      "El QR leído no corresponde a esta conferencia.",
      "error"
    );

    return;
  }

  mostrarMensaje(
    "Código reconocido. Abriendo inscripción...",
    "exito"
  );

  await detenerCamara();

  abrirAplicacion(codigo);
}


function abrirBusquedaManual() {
  const encargada = obtenerEncargada();

  if (!encargada) {
    return;
  }

  const codigo = normalizarCodigo(
    document.getElementById("codigoManual").value
  );

  if (!codigo) {
    mostrarMensaje(
      "Escribe el código de inscripción.",
      "error"
    );

    return;
  }

  if (!esCodigoValido(codigo)) {
    mostrarMensaje(
      `El código debe tener el formato ${PREFIJO_CODIGO}XXXXX.`,
      "error"
    );

    return;
  }

  abrirAplicacion(codigo);
}


function abrirAplicacion(codigo) {
  const encargada = obtenerEncargada();

  if (!encargada) {
    lecturaEnProceso = false;
    return;
  }

  guardarEncargada();

  const parametros = new URLSearchParams({
    codigo: codigo,
    encargada: encargada
  });

  /*
   * Se abre en la misma pestaña.
   * Al pulsar "Atrás" en el navegador se vuelve al escáner.
   */
  window.location.assign(
    `${URL_APPS_SCRIPT}?${parametros.toString()}`
  );
}


function normalizarCodigo(valor) {
  return String(valor || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


function esCodigoValido(codigo) {
  /*
   * Ejemplo válido:
   * CONF26-R2GCR
   *
   * Se excluyen 0, 1, I y O, igual que en Apps Script.
   */
  const expresion =
    /^CONF26-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/;

  return expresion.test(codigo);
}


function mostrarMensaje(texto, tipo) {
  const mensaje = document.getElementById("mensaje");

  mensaje.textContent = texto;
  mensaje.className =
    `mensaje mensaje-${tipo}`;
}


function ocultarMensaje() {
  const mensaje = document.getElementById("mensaje");

  mensaje.textContent = "";
  mensaje.className = "mensaje oculto";
}


function obtenerMensajeErrorCamara(error) {
  const nombre = error && error.name
    ? String(error.name)
    : "";

  const mensaje = error && error.message
    ? String(error.message)
    : "";

  if (
    nombre === "NotAllowedError" ||
    mensaje.toLowerCase().includes("permission")
  ) {
    return (
      "El navegador no tiene permiso para utilizar la cámara. " +
      "Activa el permiso de cámara para esta página."
    );
  }

  if (
    nombre === "NotFoundError" ||
    mensaje.toLowerCase().includes("not found")
  ) {
    return "No se encontró una cámara disponible en este dispositivo.";
  }

  if (
    nombre === "NotReadableError" ||
    mensaje.toLowerCase().includes("could not start")
  ) {
    return (
      "La cámara está siendo utilizada por otra aplicación. " +
      "Cierra otras aplicaciones y vuelve a intentarlo."
    );
  }

  return (
    "No fue posible activar la cámara. " +
    "Verifica los permisos o utiliza la búsqueda manual."
  );
}
