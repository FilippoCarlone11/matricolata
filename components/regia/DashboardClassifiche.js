import { Trophy, Medal, Crown } from 'lucide-react';

export default function DashboardClassifiche({ eventTeams }) {
    // Ordina i team per punteggio decrescente
    const sortedTeams = [...eventTeams].sort((a, b) => b.score - a.score);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center justify-center min-h-[80vh] py-10">
             
             <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-5 bg-yellow-500/10 rounded-full mb-4 ring-2 ring-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                    <Trophy className="text-yellow-500 w-12 h-12 md:w-16 md:h-16" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight">Classifica Serata</h2>
                <p className="text-gray-400 mt-2 font-medium">Punteggi live dell'evento</p>
             </div>

             <div className="w-full max-w-3xl space-y-4 px-4">
                 {sortedTeams.map((team, index) => {
                     let rankStyle = "bg-gray-800/80 border-gray-700 text-white hover:bg-gray-700";
                     let rankIcon = <span className="text-2xl font-black text-gray-500">#{index + 1}</span>;

                     // Effetti Podio
                     if (index === 0) {
                         rankStyle = "bg-gradient-to-r from-yellow-600/20 to-yellow-500/5 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)] scale-105 z-10";
                         rankIcon = <Crown className="text-yellow-500 w-8 h-8 drop-shadow-md" />;
                     } else if (index === 1) {
                         rankStyle = "bg-gradient-to-r from-slate-400/20 to-slate-300/5 border-slate-400/50";
                         rankIcon = <Medal className="text-slate-300 w-7 h-7 drop-shadow-md" />;
                     } else if (index === 2) {
                         rankStyle = "bg-gradient-to-r from-orange-600/20 to-orange-500/5 border-orange-500/50";
                         rankIcon = <Medal className="text-orange-500 w-7 h-7 drop-shadow-md" />;
                     }

                     return (
                         <div 
                            key={team.id} 
                            className={`rounded-2xl p-4 md:p-6 flex items-center border transition-all duration-300 ${rankStyle}`}
                         >
                             <div className="w-12 md:w-16 flex justify-center items-center shrink-0">
                                 {rankIcon}
                             </div>
                             
                             <div className="flex-1 flex items-center gap-3 ml-2">
                                 <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full shadow-md ${team.colorClass}`}></div>
                                 <h3 className={`font-black truncate ${index === 0 ? 'text-2xl md:text-3xl text-yellow-500' : 'text-xl md:text-2xl text-white'}`}>
                                    {team.name}
                                 </h3>
                             </div>

                             <div className="text-right shrink-0 bg-black/30 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/5">
                                 <span className={`font-black tracking-tighter ${index === 0 ? 'text-4xl md:text-5xl text-yellow-500' : 'text-3xl md:text-4xl text-white'}`}>
                                    {team.score}
                                 </span>
                                 <span className="text-[10px] font-bold text-gray-400 ml-1 uppercase">Pt</span>
                             </div>
                         </div>
                     )
                 })}
                 
                 {sortedTeams.length === 0 && (
                     <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-800 rounded-3xl font-medium">
                         Nessuna squadra ancora creata.<br/> Vai nel Setup per iniziare.
                     </div>
                 )}
             </div>
        </div>
    );
}