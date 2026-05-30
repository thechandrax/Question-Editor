import cloudscraper

s = cloudscraper.create_scraper()
# Use session with cookies from previous steps
s.get('https://vplink.in/7KL5')
s.get('https://freehelpdesk.in/universitesstudies/universiitessstudiess/?studiessunversietss=7KL5&uiso=20648')
s.get('https://freehelpdesk.in/universitesstudies/top-fast-track-mba-degrees-with-study-abroad-scholarships-and-elite-education-admission-study-courses-2026/')

# Set the cookie that the JS sets after ad view
s.cookies.set('adcadg', 'insurance,online_colleges,study_abroad,finance,loan')

# Now fetch the learn_more.php endpoint
r = s.get('https://freehelpdesk.in/universitesstudies/learn_more.php')
print('Status:', r.status_code)
print('URL:', r.url)
print('Content:', r.text[:3000])
with open('learn_more.html', 'w', encoding='utf-8') as f:
    f.write(r.text)
print('Saved.')
