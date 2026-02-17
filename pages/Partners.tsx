import React, { useState } from 'react';
import PartnerModal from '../components/PartnerModal';

const Partners: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  const partners = [
    {
      id: "SUP-8821",
      name: "MegaDrop Logistics",
      type: "Proveedor",
      status: "API Conectada",
      statusColor: "emerald",
      activity: "12.4k pedidos",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDu7WxNy-truHspfdbGMApSh0InEraRQBL6NTx6Ib--Tfc77waTqB2edR5z_Eka6SMZc2iqh6xfhCqJh_-bOU0TVLMa3oq9ini21yRNGjCmQtI0_mItMlSyUQFYI3ZukKk0BxM9Mj4aGnrtT-eEdZpZgKhcNAOZb_uelj1GxYAf4rhMZoMPWNB5Th4NINK6Smfgz-qmGaRyfyDDKpYvq988kUwL6UYWQ65PDhpTeJr-zcbXIjWL8_emy1-9SKfuoAEm7bZC2bfz",
      chart: ["h-[40%]", "h-[60%]", "h-[30%]", "h-[80%]", "h-[50%]", "h-[90%]"],
      typeColor: "blue"
    },
    {
      id: "RES-4402",
      name: "TrendyShop UK",
      type: "Revendedor",
      status: "Error Auth",
      statusColor: "red",
      activity: "0 pedidos",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDHbIpKpzmtV9-ce3uRQ1nMcVFt1pz3bFlEWgOruIFXpv2v9bPNequRmqDvu7FlxT1fry1aG_-ZSv6iRbAXO864g3S6qKuYtkutcc0v_KdWV6vX64d45EzkZqWcwLzF5sNd50aAvH3mpnGvXEVZ3YYWMPu5JUn8Ae42kn8Xn9gwkm20P-_wGpGwo5AebiEaP2vIVUH9CKm9QpiEeF-oZdKspgSayZiNIvHG8HCTxnv51vfh4se6aJmI5ANvIF-vvHXKklTxoUPn",
      chart: ["h-[2px]", "h-[2px]", "h-[2px]", "h-[2px]", "h-[2px]", "h-[2px]"],
      typeColor: "purple"
    },
    {
      id: "SUP-1102",
      name: "Global Trade Co",
      type: "Proveedor",
      status: "Sinc. Pendiente",
      statusColor: "amber",
      activity: "450 pedidos",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBPtl8V3-Uk48aesaPlEejzFDLYYnuIEGAs2JNFKclspZlUzI_rFk2EYUx-ftsN_dJeydFLPtj4tmP7-EXc0T-r1s5ZsCkoM3c-TwbQ2k0RzZBiyAZBcCesYwu5TjSRnGlB0gwu-S_OO9hrTxUuNljZGT9m0tFdSJooHoEgWmZF5S-DngUOskKK3l-8CQmJ0RRumvBJbdT_gtq6elMR98oa6b5KRHb6rRcKgS7xLJLr-ivOvKa_22GJZyloiYXmIVuyvFnVWFt2",
      chart: ["h-[30%]", "h-[30%]", "h-[30%]", "h-[40%]", "h-[45%]", "h-[20%]"],
      typeColor: "blue"
    },
    {
      id: "RES-9102",
      name: "Nordic Home",
      type: "Revendedor",
      status: "API Conectada",
      statusColor: "emerald",
      activity: "2.1k pedidos",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDwAtNF89SSiJwEL_tI0nBbFZ5_gBk_fi90WmcgcMLXhqyWInyOgQNCS1mGNVpCipFnxQbCI62Gz2HWhz07SBHSSqoKkNXzmFLlKE3tQmtfGFhBKEkXJe4y8WjPmbMpDQRo2sWZrdNpp-bARD239uHHF2zQzjBLtugh7tLRmcfsopcYbT6PhvJ-42ONPRPHxy2SpVwQri2wwK8oeGBPEmpddIxyl1dUP8D6e2cJsZT4Gj0FN7g2-6lwkpI8TXBG-hkt1zHp9NnX",
      chart: ["h-[20%]", "h-[25%]", "h-[35%]", "h-[60%]", "h-[70%]", "h-[85%]"],
      typeColor: "purple"
    },
    {
      id: "SUP-2139",
      name: "Alpha Source Inc.",
      type: "Proveedor",
      status: "API Conectada",
      statusColor: "emerald",
      activity: "8.9k pedidos",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA-Cn4fSF-PwtI6Ld1GTSsAq9yfzlAPujomwqTHL6Qmr1Y83wMa1PG0YLALbsp5YWtsyZoWy-asgpLyOre2F7ekA-XJfUs8wH3GK2pp3hiSYaBnorw6df4S79jASVHy5LU0JYA_A8rDMuAWcFFWAQbqTn_nfruzbBgFV_TVogn8-DBTwXZ9vvJv5lipbsRyxIVcpImtwtJK-ggDb2CQ05FCRuSA_x-mZPBN9jxEY2Sa-iZGQdoJpBDms8fhnxoGGyrtznvBDDaG",
      chart: ["h-[50%]", "h-[45%]", "h-[60%]", "h-[55%]", "h-[75%]", "h-[80%]"],
      typeColor: "blue"
    },
    {
      id: "RES-0042",
      name: "FastLane Retail",
      type: "Revendedor",
      status: "Desconectado",
      statusColor: "slate",
      activity: "--",
      img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnz6mihuZQBGo0ygFduAq0voctJnEU-o6Buwyv_JodYnh5U2xYdrQgVi-f1vYKJEQ0z71dkFqYN6sNRuGULZmqhmeSLHdSnTGJNMySYjchaIx6W8jWFEPTHMhXqaUbST0IYRpWqq3Xi4J794MzoOPCcwkFf7Rf6VwdU7wFxd4UP2XbGdn0CuXKLZ3q-zghzebJ32nYaXVDdeH7EijweoJfzTIiYaJUuk9-s0L057uMJIXEASNCpaI2mi_nukAszD0CK3cqH-f4",
      chart: [],
      typeColor: "slate"
    }
  ];

  const handleOpenModal = (partner: any = null) => {
    setSelectedPartner(partner);
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-[1400px] mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Directorio de Socios</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gestiona tus proveedores de dropshipping y redes de revendedores.</p>
        </div>
        <div className="flex gap-3">
          <button className="hidden md:flex items-center justify-center h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151f2b] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold transition-colors gap-2">
            <span className="material-symbols-outlined text-[20px]">file_upload</span>
            Importar
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center h-10 px-5 rounded-lg bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Añadir Socio
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">search</span>
          <input
            className="w-full pl-10 pr-4 h-11 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151f2b] text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400 dark:text-white shadow-sm"
            placeholder="Buscar socios por nombre, ID o email..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-slate-500 font-medium">Ordenar por:</span>
          <select className="h-11 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-[#151f2b] text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 dark:text-white shadow-sm cursor-pointer pl-3 pr-8 py-0">
            <option>Actividad Reciente</option>
            <option>Nombre (A-Z)</option>
            <option>Mayor Volumen</option>
            <option>Estado</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {partners.map((partner) => {
          const isError = partner.statusColor === 'red' || partner.statusColor === 'slate';
          const isInactive = partner.statusColor === 'slate';

          return (
            <div key={partner.id} className={`group bg-white dark:bg-[#151f2b] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-primary/30 dark:hover:border-primary/30 flex flex-col ${isInactive ? 'opacity-75 hover:opacity-100 bg-slate-50 dark:bg-[#151f2b]/50' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-3">
                  <div className={`size-12 rounded-lg p-0.5 border border-slate-100 dark:border-slate-700 overflow-hidden ${isInactive ? 'grayscale bg-slate-200 dark:bg-slate-700' : 'bg-slate-100 dark:bg-slate-800'}`}>
                    <img alt={`${partner.name} Logo`} className="w-full h-full object-cover rounded-md" src={partner.img} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-slate-900 dark:text-white leading-tight ${!isInactive && 'group-hover:text-primary'} transition-colors`}>{partner.name}</h3>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 mt-1">
                      ID: #{partner.id}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleOpenModal(partner)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border
                    ${partner.typeColor === 'blue' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-800' : ''}
                    ${partner.typeColor === 'purple' ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-100 dark:border-purple-800' : ''}
                    ${partner.typeColor === 'slate' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' : ''}
                `}>
                  {partner.type}
                </span>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ml-auto
                    ${partner.statusColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30' : ''}
                    ${partner.statusColor === 'amber' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-900/30' : ''}
                    ${partner.statusColor === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900/30' : ''}
                    ${partner.statusColor === 'slate' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-500 border-slate-300 dark:border-slate-700' : ''}
                `}>
                  <span className={`size-1.5 rounded-full 
                    ${partner.statusColor === 'emerald' ? 'bg-emerald-500 animate-pulse' : ''}
                    ${partner.statusColor === 'amber' ? 'bg-amber-500' : ''}
                    ${partner.statusColor === 'red' ? 'bg-red-500' : ''}
                    ${partner.statusColor === 'slate' ? 'bg-slate-400' : ''}
                  `}></span>
                  {partner.status}
                </span>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs text-slate-500 font-medium">Actividad (30d)</span>
                  <span className={`text-xs font-bold ${isInactive ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white'}`}>{partner.activity}</span>
                </div>

                {isInactive ? (
                  <div className="h-8 w-full flex items-center justify-center mb-4 opacity-50">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Sin Datos Recientes</p>
                  </div>
                ) : (
                  <div className={`h-8 w-full flex items-end gap-1 mb-4 opacity-80`}>
                    {partner.chart.map((height, i) => (
                      <div key={i} className={`w-1/6 rounded-sm ${height}
                            ${partner.statusColor === 'emerald' || partner.statusColor === 'blue' ? 'bg-primary' : ''}
                            ${partner.statusColor === 'amber' ? 'bg-amber-500' : ''}
                            ${partner.statusColor === 'red' ? 'bg-slate-200 dark:bg-slate-700' : ''}
                         `} style={{ opacity: (i + 2) / 8 }}></div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => handleOpenModal(partner)}
                  className={`w-full flex items-center justify-center h-9 rounded-lg border bg-transparent text-sm font-semibold transition-colors
                    ${isInactive
                      ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                      : isError && partner.statusColor === 'red'
                        ? 'border-slate-200 dark:border-slate-700 hover:border-red-500 hover:text-red-600 text-slate-600 dark:text-slate-300 dark:hover:text-red-400'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary text-slate-600 dark:text-slate-300 dark:hover:text-primary'
                    }
                `}>
                  {isInactive ? 'Reconectar' : (isError && partner.statusColor === 'red' ? 'Arreglar Conexión' : 'Ver Perfil')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 mt-8 pt-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mostrando <span className="font-medium text-slate-900 dark:text-white">1</span> a <span className="font-medium text-slate-900 dark:text-white">6</span> de <span className="font-medium text-slate-900 dark:text-white">142</span> socios
        </p>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
            Anterior
          </button>
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
            Siguiente
          </button>
        </div>
      </div>

      <PartnerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        partner={selectedPartner}
      />
    </div>
  );
};

export default Partners;