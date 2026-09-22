import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { api } from '../api'
import CityCanvas from '../render/CityCanvas'
import { CITY_PLACES } from '../render/cityMap'
import Icon from '../components/Icon'

const PLACE_ICON = {
  casa: 'sofa',
  fliperama: 'game',
  petshop: 'paw',
  mercado: 'bag',
  praca: 'camera',
  missoes: 'check',
}

export default function City() {
  const [avatar,setAvatar]=useState(null)
  useEffect(()=>{ api.get('/api/avatar').then((data)=>setAvatar(data.config)).catch(()=>{}) },[])
  return (
    <>
      <div className="row between" style={{marginBottom:8}}>
        <div>
          <div className="muted tiny">nosso mundinho</div>
          <h1 className="screen-title" style={{margin:0}}>Cidade do casal</h1>
        </div>
        <span className="pill sage">6 lugares</span>
      </div>
      <p className="muted small city-help">Toque na rua para caminhar. Toque em um prédio para ir até a porta e entrar.</p>
      <CityCanvas avatar={avatar}/>
      <div className="city-places">
        {CITY_PLACES.map((place)=>(
          <Link key={place.code} to={place.route} className="city-place-card">
            <span className="city-place-icon"><Icon name={PLACE_ICON[place.code]} size={20}/></span>
            <span className="grow"><strong>{place.name}</strong><small>{place.hint}</small></span>
            <span aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </>
  )
}
