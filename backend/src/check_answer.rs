use axum::{Json, http::StatusCode};
use uuid::Uuid;
use serde::{Deserialize, Serialize};

// /api/checkAnswer
// req body => {questionId: uuid, answer: string, lat: double float idk whatever, long: also double float idk whatever, user}
// res json => { wrong answer }, status 467 || { not found }, status 404, { questionId, question } 
// description: fetch question from uuid, then strip and normalise (lowercase) the answer, then match it with the answer string, if correct, check haversine distance of lat long from question location, if within DISTANCE (50m by default in ENV), find team of user from db and append entire team of user to the question under "foundBy" field (array), then call findRandomLeastFound() and return the question
#[derive(Debug, Deserialize)]
pub struct CheckAnswerRequest {
    #[serde(rename = "questionId")]
    question_id: String,
    answer: String,
    lat: f64,
    lng: f64
}
#[derive(Debug, Serialize)]
pub struct CheckAnswerResponse {}
pub async fn api_check_answer(Json(req): Json<CheckAnswerRequest>) -> (StatusCode, Json<CheckAnswerResponse>) {
    #[cfg(debug_assertions)]
    println!("/api/checkAnswer: {:?}", req);

    let response = CheckAnswerResponse {};
    if let Err(e) = Uuid::parse_str(&req.question_id) {
        // fuck youuuuuuuuuuuuu
        // you think you crashed the backend but I PLAYED YOU BITCH
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(response));
    }

    (StatusCode::NOT_FOUND, Json(response))
}
