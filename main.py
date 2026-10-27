import sys
import re
import json

def extract_sentences_and_dialogues(text):
    # Pattern to match French dialogue or standard sentences
    pattern = r'«[^»]+»|[^«»!?.]+[!?.]'
    matches = re.findall(pattern, text)
    
    cleaned_matches = []
    for match in matches:
        match = match.strip()
        if not match:
            continue
            
        # 1. Replace « with " and » with "
        match = match.replace('«', '"').replace('»', '"')
        
        # 2. Remove space right after an opening quote
        match = re.sub(r'"\s+', '"', match)
        
        # 3. Remove space right before a closing quote
        match = re.sub(r'\s+"', '"', match)
        
        cleaned_matches.append(match)
        
    return cleaned_matches


def parse_chapters(text):
    # Pattern to detect chapter headers like "Chapitre 4 — Les aimants" or "Chapitre 1"
    # Matches "Chapitre" followed by a number/title until a double newline or end of line
    chapter_pattern = r'(Chapitre\s+\d+.*?)(?=\n\n|\n[A-Z]|$)'
    
    # Split the text by chapter headings while capturing the headers
    # regex pattern splits and keeps the matched headers when using capturing groups `(...)`
    parts = re.split(r'^(Chapitre\s+\d+.*?)$', text, flags=re.MULTILINE)
    
    chapters_data = {}
    current_chapter = "Intro"  # Default name for content before Chapitre 1 (if any)
    
    for part in parts:
        part_str = part.strip()
        if not part_str:
            continue
        
        # Check if this part is a chapter header line
        if re.match(r'^Chapitre\s+\d+', part_str, re.IGNORECASE):
            current_chapter = part_str
            if current_chapter not in chapters_data:
                chapters_data[current_chapter] = []
        else:
            # Process sentences inside the current chapter text body
            sentences = extract_sentences_and_dialogues(part_str)
            if current_chapter not in chapters_data:
                chapters_data[current_chapter] = []
            chapters_data[current_chapter].extend(sentences)
            
    # Remove "Intro" if empty
    if "Intro" in chapters_data and not chapters_data["Intro"]:
        del chapters_data["Intro"]
        
    return chapters_data


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python script.py <input_file> [output_file.json]")
        sys.exit(1)
        
    filePath = sys.argv[1]
    outputFilePath = sys.argv[2] if len(sys.argv) > 2 else 'output.json'
    
    with open(filePath, encoding='utf-8') as f:
        text = f.read()
    
    structured_chapters = parse_chapters(text)
    
    # Save the dictionary of chapter arrays into a JSON file
    with open(outputFilePath, 'w', encoding='utf-8') as json_file:
        json.dump(structured_chapters, json_file, ensure_ascii=False, indent=4)
        
    print(f"Successfully processed {len(structured_chapters)} chapters into {outputFilePath}")
    print('End.')