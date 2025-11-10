use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

// /api/getTarget 
// req body => {lat, long, user}
// res json => { question }
// description: polled ruthlessly every 5 seconds or on locar gps update, checks haversine distance of every single point (50 or so, cached in global variable in memory
#[derive(Debug, Deserialize)]
pub struct GetTargetRequest {
    lat: f64,
    lng: f64,
}
#[derive(Debug, Serialize)]
pub struct GetTargetResponse {
    question: String
}
pub async fn api_get_target(Json(req): Json<GetTargetRequest>) -> (StatusCode, Json<GetTargetResponse>) {
    #[cfg(debug_assertions)]
    println!("/api/getTarget: {:?}", req);

    let response = GetTargetResponse {
        question: String::new(),
    };

    (StatusCode::NOT_FOUND, Json(response))
}

