export function assemblyPartyName(party: string): string {
  const names: Record<string,string> = {
    'Democratic Unionist Party - D.U.P.': 'Democratic Unionist Party',
    'Alliance Party': 'Alliance',
    'SDLP (Social Democratic & Labour Party)': 'Social Democratic and Labour Party',
    'TUV - No Sea Border': 'Traditional Unionist Voice',
    'Conservative and Unionist Party': 'Conservative Party'
  };
  return names[party] ?? party;
}
