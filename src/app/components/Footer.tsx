"use client";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h4 className="mb-2 font-semibold">MFL Platform</h4>
            <p className="text-sm text-gray-400">
              Plataforma de gestión de datos de investigación de suelos para el equipo Multifunctional Landscapes.
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Acerca de</h4>
            <ul className="text-sm text-gray-400">
              <li>Alianza Bioversity - CIAT</li>
              <li>Equipo Multifunctional Landscapes</li>
              <li>Investigación en Sostenibilidad Agrícola</li>
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Soporte</h4>
            <ul className="text-sm text-gray-400">
              <li>Documentación</li>
              <li>Tutoriales</li>
              <li>Contacto</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-800 pt-6 text-sm text-gray-500">
          © {new Date().getFullYear()} Alianza Bioversity Internacional - CIAT. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;