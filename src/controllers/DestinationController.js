import axios from "axios";



const destinationController = async (req, res) => {
    const { query } = req.body;
    console.log("🚀 ~ destinationController ~ query:", req.body)
    const response = await axios.get(`https://www.ratehawk.com/api/site/multicomplete.json?query=${query}&locale=en`);

    res.json(response.data);
}

export default destinationController;